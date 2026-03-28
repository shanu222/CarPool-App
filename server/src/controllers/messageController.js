import { Message } from "../models/Message.js";
import { Ride } from "../models/Ride.js";
import { sendPushNotification } from "../services/pushService.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { Match } from "../models/Match.js";
import { ChatAccess } from "../models/ChatAccess.js";
import { getIo } from "../socket/io.js";
import { isUserOnline } from "../socket/io.js";
import { createUserNotification } from "../services/notificationService.js";

const RIDE_AUTO_COMPLETE_HOURS = Number(process.env.RIDE_AUTO_COMPLETE_HOURS || 6);
const CHAT_OPEN_TOKEN_COST = 2;
const TOKEN_RATE_PER_PKR = 2;

const resolveRideStatusForChat = async (ride) => {
  if (!ride) {
    return null;
  }

  if (String(ride.status) === "matched") {
    return "matched";
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
  const approvedMatches = await Match.find({
    rideId,
    status: "approved",
  }).select("passengerId");

  const matchedPassengerIds = approvedMatches.map((item) => String(item.passengerId));
  const participantSet = new Set([String(rideDriverId), ...passengerIds, ...matchedPassengerIds]);
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

  if (hasBooking) {
    return true;
  }

  const hasApprovedMatch = await Match.exists({
    rideId: ride._id,
    status: "approved",
    $or: [{ driverId: userId }, { passengerId: userId }],
  });

  return Boolean(hasApprovedMatch);
};

const getApprovedMatchForUser = async (rideId, userId) => {
  return Match.findOne({
    rideId,
    status: "approved",
    $or: [{ driverId: userId }, { passengerId: userId }],
  });
};

const normalizeCount = (value) => Math.max(0, Number(value || 0));

const buildInsufficientTokenPayload = (userDoc) => ({
  error: "INSUFFICIENT_TOKENS",
  message: "Insufficient tokens. Please recharge.",
  requiresPayment: true,
  redirectTo: "/payment-methods",
  tokenInfo: {
    tokenRate: TOKEN_RATE_PER_PKR,
    costPerAction: CHAT_OPEN_TOKEN_COST,
  },
  tokensLeft: normalizeCount(userDoc?.tokens),
  tokensSpent: normalizeCount(userDoc?.tokensSpent),
});

const ensureChatOpenAccess = async ({ user, rideId }) => {
  if (user?.role === "admin") {
    return { ok: true, alreadyUnlocked: true };
  }

  const existingAccess = await ChatAccess.findOne({
    userId: user._id,
    rideId,
    unlocked: true,
  }).select("_id");

  if (existingAccess) {
    return { ok: true, alreadyUnlocked: true };
  }

  const chargedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      tokens: { $gte: CHAT_OPEN_TOKEN_COST },
    },
    {
      $inc: {
        tokens: -CHAT_OPEN_TOKEN_COST,
        tokenBalance: -CHAT_OPEN_TOKEN_COST,
        tokensSpent: CHAT_OPEN_TOKEN_COST,
      },
    },
    {
      new: true,
    }
  ).select("_id tokens tokenBalance tokensSpent");

  if (!chargedUser) {
    const latestUser = await User.findById(user._id).select("tokens tokensSpent");
    return {
      ok: false,
      payload: buildInsufficientTokenPayload(latestUser),
    };
  }

  try {
    await ChatAccess.create({
      userId: user._id,
      rideId,
      unlocked: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      await User.findByIdAndUpdate(user._id, {
        $inc: {
          tokens: CHAT_OPEN_TOKEN_COST,
          tokenBalance: CHAT_OPEN_TOKEN_COST,
          tokensSpent: -CHAT_OPEN_TOKEN_COST,
        },
      });
      return { ok: true, alreadyUnlocked: true };
    }

    throw error;
  }

  return {
    ok: true,
    alreadyUnlocked: false,
    tokensLeft: normalizeCount(chargedUser.tokens),
    tokensSpent: normalizeCount(chargedUser.tokensSpent),
  };
};

const validateChatContext = async ({ rideId, user }) => {
  const ride = await Ride.findById(rideId).select("driver status dateTime startTime");

  if (!ride) {
    return { errorStatus: 404, errorPayload: { message: "Ride not found" } };
  }

  const approvedMatch = await getApprovedMatchForUser(rideId, user._id);
  const isMatchedRide = String(ride.status) === "matched";

  if (isMatchedRide && !approvedMatch && user?.role !== "admin") {
    return {
      errorStatus: 403,
      errorPayload: { message: "Chat is available only after both users approve the match." },
    };
  }

  const currentStatus = await resolveRideStatusForChat(ride);

  if (!isMatchedRide && !["live", "scheduled", "nearby"].includes(String(currentStatus))) {
    return { errorStatus: 403, errorPayload: { message: "Chat is only available for live and scheduled rides." } };
  }

  const participant = await isRideParticipant(ride, user._id);
  if (!participant && user?.role !== "admin") {
    return { errorStatus: 403, errorPayload: { message: "Only ride participants can access chat" } };
  }

  return {
    ride,
    isMatchedRide,
  };
};

export const startRideChatAccess = async (req, res, next) => {
  try {
    const { rideId } = req.params;

    const context = await validateChatContext({ rideId, user: req.user });
    if (context?.errorStatus) {
      return res.status(context.errorStatus).json(context.errorPayload);
    }

    const access = await ensureChatOpenAccess({ user: req.user, rideId });
    if (!access.ok) {
      return res.status(403).json(access.payload);
    }

    return res.json({
      ok: true,
      unlocked: true,
      alreadyUnlocked: access.alreadyUnlocked,
      tokensLeft: normalizeCount(access.tokensLeft ?? req.user?.tokens),
      tokensSpent: normalizeCount(access.tokensSpent ?? req.user?.tokensSpent),
    });
  } catch (error) {
    return next(error);
  }
};

export const getRideMessages = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const context = await validateChatContext({ rideId, user: req.user });
    if (context?.errorStatus) {
      return res.status(context.errorStatus).json(context.errorPayload);
    }

    const access = await ensureChatOpenAccess({ user: req.user, rideId });
    if (!access.ok) {
      return res.status(403).json(access.payload);
    }

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

    return res.json(messages.map((item) => mapMessagePayload(item)));
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

    const approvedMatch = await getApprovedMatchForUser(rideId, req.user._id);
    const isMatchedRide = String(ride.status) === "matched";

    if (isMatchedRide && !approvedMatch && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Chat is available only after both users approve the match." });
    }

    const chatStatus = await resolveRideStatusForChat(ride);

    if (["completed", "cancelled"].includes(String(chatStatus))) {
      return res.status(403).json({ message: "This ride is completed. Chat is disabled." });
    }

    if (!isMatchedRide && !["live", "scheduled", "nearby"].includes(String(chatStatus))) {
      return res.status(403).json({ message: "Chat is only available for live and scheduled rides." });
    }

    const participant = await isRideParticipant(ride, req.user._id);
    if (!participant && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only ride participants can chat" });
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
        io.to(`user:${String(targetId)}`).emit("new_message", payload);
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

    return res.status(201).json(payload);
  } catch (error) {
    return next(error);
  }
};
