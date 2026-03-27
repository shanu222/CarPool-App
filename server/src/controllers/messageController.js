import { Message } from "../models/Message.js";
import { Ride } from "../models/Ride.js";
import { Payment } from "../models/Payment.js";
import { sendPushNotification } from "../services/pushService.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { getIo } from "../socket/io.js";
import { isUserOnline } from "../socket/io.js";
import { createUserNotification } from "../services/notificationService.js";
import {
  getActionTokenStatus,
  refundReservedActionCredit,
  reserveActionCredit,
} from "../services/tokenAccessService.js";

const RIDE_AUTO_COMPLETE_HOURS = Number(process.env.RIDE_AUTO_COMPLETE_HOURS || 6);
const FREE_CHAT_MESSAGE_LIMIT = 5;
const PHONE_REGEX = /(\+?\d[\d\s\-()]{7,}\d)/;
const WHATSAPP_LINK_REGEX = /(wa\.me\/|chat\.whatsapp\.com\/|whatsapp\.com\/)/i;

const resolveRideStatusForChat = async (ride) => {
  if (!ride) {
    return null;
  }

  if (["completed", "cancelled"].includes(String(ride.status))) {
    return ride.status;
  }

  const start = ride.startTime || ride.dateTime;
  if (!start) {
    return ride.status;
  }

  const now = new Date();
  const nearbyUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (new Date(start) <= now) {
    ride.status = "live";
  } else if (new Date(start) <= nearbyUntil) {
    ride.status = "nearby";
  } else {
    ride.status = "scheduled";
  }

  const completedBefore = new Date(Date.now() - RIDE_AUTO_COMPLETE_HOURS * 60 * 60 * 1000);
  if (new Date(start) <= completedBefore) {
    ride.status = "completed";
    await ride.save();
    await Booking.updateMany(
      { rideId: ride._id, status: { $in: ["accepted", "booked", "ongoing"] } },
      { status: "completed" }
    );
    return "completed";
  }

  await ride.save();
  return ride.status;
};

const mapMessagePayload = (messageDoc) => {
  const messageObj = typeof messageDoc.toObject === "function" ? messageDoc.toObject() : messageDoc;

  return {
    ...messageObj,
    ride: messageObj.rideId,
    sender: messageObj.senderId,
    receiver: messageObj.receiverId,
    text: messageObj.message,
    createdAt: messageObj.createdAt || messageObj.timestamp,
  };
};

const isConversationBlocked = async (aUserId, bUserId) => {
  const [aUser, bUser] = await Promise.all([
    User.findById(aUserId).select("blockedUsers"),
    User.findById(bUserId).select("blockedUsers"),
  ]);

  if (!aUser || !bUser) {
    return false;
  }

  const aBlockedB = (aUser.blockedUsers || []).some((id) => String(id) === String(bUserId));
  const bBlockedA = (bUser.blockedUsers || []).some((id) => String(id) === String(aUserId));
  return aBlockedB || bBlockedA;
};

const getRideParticipantIds = async (rideId, rideDriverId) => {
  const acceptedBookings = await Booking.find({
    rideId,
    status: { $in: ["accepted", "booked", "ongoing", "completed"] },
  }).select("passengerId");

  const passengerIds = acceptedBookings.map((item) => String(item.passengerId));
  const participantSet = new Set([String(rideDriverId), ...passengerIds]);
  return [...participantSet];
};

const isRideParticipant = async (ride, userId) => {
  if (String(ride.driver) === String(userId)) {
    return true;
  }

  const hasBooking = await Booking.exists({
    rideId: ride._id,
    passengerId: userId,
    status: { $in: ["accepted", "booked", "ongoing", "completed"] },
  });

  return Boolean(hasBooking);
};

const hasInteractionAccess = async (userId, rideId, role) => {
  if (role === "admin") {
    return true;
  }

  const approvedPayment = await Payment.exists({
    userId,
    rideId,
    type: "interaction_unlock",
    status: "approved",
  });

  return Boolean(approvedPayment);
};

const containsLockedContactContent = (text) => {
  const value = String(text || "");
  return PHONE_REGEX.test(value) || WHATSAPP_LINK_REGEX.test(value);
};

const getFreeMessageUsage = async ({ rideId, userId }) => {
  const sentCount = await Message.countDocuments({ rideId, senderId: userId });
  const remaining = Math.max(0, FREE_CHAT_MESSAGE_LIMIT - sentCount);
  return {
    sentCount,
    remaining,
    limitReached: sentCount >= FREE_CHAT_MESSAGE_LIMIT,
  };
};

export const getRideMessages = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId).select("driver status dateTime startTime");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    await resolveRideStatusForChat(ride);

    if (ride.status !== "live") {
      return res.status(403).json({ message: "Chat is only available for live rides." });
    }

    const participant = await isRideParticipant(ride, req.user._id);

    if (!participant && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only ride participants can access chat" });
    }

    const unlocked = await hasInteractionAccess(req.user._id, rideId, req.user?.role);

    await Message.updateMany(
      {
        rideId,
        receiverId: req.user._id,
        isSeen: false,
      },
      {
        $set: { isSeen: true },
      }
    );

    const messages = await Message.find({ rideId })
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ timestamp: 1 });

    const usage = await getFreeMessageUsage({ rideId, userId: req.user._id });
    return res.json(
      messages.map((item) => ({
        ...mapMessagePayload(item),
        _meta: {
          unlocked,
          freeMessagesRemaining: usage.remaining,
          freeLimitReached: usage.limitReached,
        },
      }))
    );
  } catch (error) {
    return next(error);
  }
};

export const markRideMessagesSeen = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    await Message.updateMany(
      {
        rideId,
        receiverId: req.user._id,
        isSeen: false,
      },
      {
        $set: { isSeen: true },
      }
    );

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  let reservedCreditSource = null;

  try {
    const { rideId, receiverId, text, message: messageText } = req.body;
    const normalizedText = String(text || messageText || "").trim();

    if (!rideId || !normalizedText) {
      return res.status(400).json({ message: "rideId and message are required" });
    }

    const ride = await Ride.findById(rideId).populate("driver", "_id name");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const chatStatus = await resolveRideStatusForChat(ride);

    if (["completed", "cancelled"].includes(String(chatStatus))) {
      return res.status(403).json({ message: "This ride is completed. Chat is disabled." });
    }

    if (chatStatus !== "live") {
      return res.status(403).json({ message: "Chat is only available for live rides." });
    }

    const participant = await isRideParticipant(ride, req.user._id);
    if (!participant && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only ride participants can chat" });
    }

    if (req.user?.role !== "admin") {
      const tokenStatus = await getActionTokenStatus({
        userId: req.user._id,
        action: "chat",
      });

      if (!tokenStatus.allowed) {
        return res.status(403).json({ message: "Not enough tokens to perform this action" });
      }
    }

    const unlocked = await hasInteractionAccess(req.user._id, rideId, req.user?.role);

    if (!unlocked && containsLockedContactContent(normalizedText)) {
      return res.status(403).json({ message: "Phone numbers and WhatsApp links are blocked before payment unlock." });
    }

    if (!unlocked) {
      const usage = await getFreeMessageUsage({ rideId, userId: req.user._id });
      if (usage.limitReached) {
        return res.status(403).json({ message: "Free chat limit reached. Pay to unlock unlimited chat and contact." });
      }
    }

    const participantIds = await getRideParticipantIds(rideId, ride.driver._id);
    const normalizedReceiverId = receiverId ? String(receiverId) : null;

    if (normalizedReceiverId && !participantIds.includes(normalizedReceiverId)) {
      return res.status(400).json({ message: "receiverId must belong to this ride" });
    }

    const recipients = normalizedReceiverId
      ? [normalizedReceiverId]
      : participantIds.filter((id) => String(id) !== String(req.user._id));

    if (!recipients.length) {
      return res.status(400).json({ message: "No chat recipients available" });
    }

    if (req.user?.role !== "admin") {
      const reservation = await reserveActionCredit({
        userId: req.user._id,
        action: "chat",
      });

      if (!reservation.reserved) {
        return res.status(403).json({ message: "Not enough tokens to perform this action" });
      }

      reservedCreditSource = reservation.source;
    }

    const blockedChecks = await Promise.all(recipients.map((participantId) => isConversationBlocked(req.user._id, participantId)));
    if (blockedChecks.some(Boolean)) {
      return res.status(403).json({ message: "User blocked" });
    }

    const notificationTargets = recipients;

    const createdMessage = await Message.create({
      rideId,
      senderId: req.user._id,
      receiverId: normalizedReceiverId || null,
      message: normalizedText,
      timestamp: new Date(),
      isSeen: false,
    });

    const populated = await Message.findById(createdMessage._id)
      .populate("senderId", "name role")
      .populate("receiverId", "name role");

    const payload = mapMessagePayload(populated);

    const io = getIo();
    if (io) {
      io.to(`ride:${rideId}`).emit("receive_message", payload);
      io.to(`ride:${rideId}`).emit("new_message", payload);
      notificationTargets.forEach((targetId) => {
        io.to(`user:${String(targetId)}`).emit("receive_message", payload);
      });
    }

    await Promise.all(
      notificationTargets.map(async (targetId) => {
        await createUserNotification({
          userId: targetId,
          type: "message",
          title: "New message",
          body: `${req.user.name} sent a message in ride chat`,
          data: { rideId, messageId: createdMessage._id },
          pushFallback: false,
        });

        if (!isUserOnline(targetId)) {
          const receiver = await User.findById(targetId).select("fcmToken");

          await sendPushNotification({
            token: receiver?.fcmToken,
            title: `New message from ${req.user.name}`,
            body: normalizedText.slice(0, 80),
            data: { rideId, messageId: String(createdMessage._id) },
          });
        }
      })
    );

    reservedCreditSource = null;

    return res.status(201).json(payload);
  } catch (error) {
    if (reservedCreditSource) {
      await refundReservedActionCredit({
        userId: req.user?._id,
        action: "chat",
        source: reservedCreditSource,
      });
    }

    return next(error);
  }
};
