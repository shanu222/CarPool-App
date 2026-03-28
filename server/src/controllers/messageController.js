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
import { areUsersBlocked } from "../utils/blocking.js";
import mongoose from "mongoose";

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

const ensureNoBlockedParticipant = async (rideId, rideDriverId, currentUserId) => {
  const participantIds = await getRideParticipantIds(rideId, rideDriverId);
  const otherParticipantIds = participantIds.filter((id) => String(id) !== String(currentUserId));

  if (!otherParticipantIds.length) {
    return false;
  }

  const checks = await Promise.all(otherParticipantIds.map((id) => areUsersBlocked(currentUserId, id)));
  return checks.some(Boolean);
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

  if (user?.role !== "admin") {
    const hasBlockedParticipant = await ensureNoBlockedParticipant(rideId, ride.driver, user._id);
    if (hasBlockedParticipant) {
      return { errorStatus: 403, errorPayload: { message: "Chat unavailable due to block settings." } };
    }
  }

  return {
    ride,
    isMatchedRide,
  };
};

const ACTIVE_RIDE_STATUSES = new Set(["live", "scheduled", "nearby", "matched"]);

const toIsoOrNull = (value) => {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const asComparableTime = (value) => {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const getConversationList = async (req, res, next) => {
  try {
    const userId = String(req.user?._id || "").trim();
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [driverRides, passengerBookings, matches, messageRideIds] = await Promise.all([
      Ride.find({ driver: userId }).select("_id"),
      Booking.find({
        passengerId: userId,
        status: { $ne: "rejected" },
      }).select("rideId"),
      Match.find({
        $or: [{ driverId: userId }, { passengerId: userId }],
      }).select("rideId"),
      Message.distinct("rideId", {
        $or: [{ senderId: userId }, { receiverId: userId }],
      }),
    ]);

    const rideIdSet = new Set([
      ...driverRides.map((item) => String(item._id)),
      ...passengerBookings.map((item) => String(item.rideId)),
      ...matches.map((item) => String(item.rideId)),
      ...messageRideIds.map((item) => String(item)),
    ]);

    const allRideIds = [...rideIdSet].filter(Boolean);
    if (!allRideIds.length) {
      return res.json([]);
    }

    const objectRideIds = allRideIds.map((item) => new mongoose.Types.ObjectId(item));

    const [rides, bookingRows, matchRows, lastMessages] = await Promise.all([
      Ride.find({ _id: { $in: allRideIds } })
        .populate("driver", "name role profilePhoto isVerified")
        .lean(),
      Booking.find({
        rideId: { $in: allRideIds },
        status: { $ne: "rejected" },
      })
        .select("rideId passengerId")
        .populate("passengerId", "name role profilePhoto isVerified")
        .lean(),
      Match.find({ rideId: { $in: allRideIds } })
        .select("rideId driverId passengerId")
        .populate("driverId", "name role profilePhoto isVerified")
        .populate("passengerId", "name role profilePhoto isVerified")
        .lean(),
      Message.aggregate([
        {
          $match: {
            rideId: { $in: objectRideIds },
          },
        },
        {
          $sort: {
            timestamp: -1,
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: "$rideId",
            message: { $first: "$message" },
            timestamp: { $first: "$timestamp" },
            createdAt: { $first: "$createdAt" },
            senderId: { $first: "$senderId" },
            receiverId: { $first: "$receiverId" },
          },
        },
      ]),
    ]);

    const lastMessageByRide = new Map(lastMessages.map((row) => [String(row._id), row]));

    const participantByRide = new Map();
    const addParticipant = (rideId, participant) => {
      if (!participant || !rideId) {
        return;
      }

      const list = participantByRide.get(String(rideId)) || [];
      const participantId = String(participant._id || participant.id || "");
      if (!participantId || participantId === userId) {
        participantByRide.set(String(rideId), list);
        return;
      }

      if (!list.some((item) => String(item._id || item.id || "") === participantId)) {
        list.push(participant);
      }

      participantByRide.set(String(rideId), list);
    };

    bookingRows.forEach((row) => {
      addParticipant(row.rideId, row.passengerId);
    });

    matchRows.forEach((row) => {
      addParticipant(row.rideId, row.driverId);
      addParticipant(row.rideId, row.passengerId);
    });

    const senderReceiverIds = [...new Set(
      lastMessages
        .flatMap((item) => [item.senderId, item.receiverId])
        .filter(Boolean)
        .map((item) => String(item))
    )];

    const senderReceiverUsers = await User.find({ _id: { $in: senderReceiverIds } })
      .select("name role profilePhoto isVerified")
      .lean();

    const senderReceiverMap = new Map(senderReceiverUsers.map((item) => [String(item._id), item]));

    const conversations = rides
      .filter((ride) => {
        const driverId = String(ride.driver?._id || ride.driver || "");
        if (driverId === userId) {
          return true;
        }

        return (participantByRide.get(String(ride._id)) || []).some(
          (participant) => String(participant?._id || "") === userId
        );
      })
      .map((ride) => {
        const rideId = String(ride._id);
        const rideStatus = String(ride.status || "scheduled").toLowerCase();
        const isActive = ACTIVE_RIDE_STATUSES.has(rideStatus);
        const lastMessage = lastMessageByRide.get(rideId);
        const participants = participantByRide.get(rideId) || [];

        const lastSenderId = String(lastMessage?.senderId || "");
        const lastReceiverId = String(lastMessage?.receiverId || "");

        const lastOtherId =
          lastSenderId && lastSenderId !== userId
            ? lastSenderId
            : lastReceiverId && lastReceiverId !== userId
            ? lastReceiverId
            : "";

        const fromLastMessage = lastOtherId ? senderReceiverMap.get(lastOtherId) : null;
        const defaultCounterpart =
          String(ride.driver?._id || ride.driver || "") === userId ? participants[0] || null : ride.driver || null;
        const counterpart = fromLastMessage || defaultCounterpart || null;

        const lastMessageAt =
          toIsoOrNull(lastMessage?.timestamp || lastMessage?.createdAt) ||
          toIsoOrNull(ride.updatedAt || ride.createdAt || ride.dateTime) ||
          new Date(0).toISOString();

        return {
          rideId,
          rideStatus,
          isActive,
          route: `${ride.fromCity || ""} -> ${ride.toCity || ""}`,
          ride: {
            _id: rideId,
            fromCity: ride.fromCity,
            toCity: ride.toCity,
            date: ride.date,
            time: ride.time,
            status: ride.status,
          },
          counterpart: counterpart
            ? {
                _id: counterpart._id,
                name: counterpart.name,
                role: counterpart.role,
                profilePhoto: counterpart.profilePhoto,
                isVerified: Boolean(counterpart.isVerified),
              }
            : null,
          lastMessage: lastMessage?.message || "No messages yet",
          lastMessageAt,
          hasMessages: Boolean(lastMessage?.message),
        };
      })
      .sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }

        return asComparableTime(right.lastMessageAt) - asComparableTime(left.lastMessageAt);
      });

    return res.json(conversations);
  } catch (error) {
    return next(error);
  }
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

    const blockedChecks = await Promise.all(recipients.map((participantId) => areUsersBlocked(req.user._id, participantId)));
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
