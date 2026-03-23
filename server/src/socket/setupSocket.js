import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { setIo, setUserOffline, setUserOnline, isUserOnline } from "./io.js";
import { Location } from "../models/Location.js";
import { Ride } from "../models/Ride.js";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { Notification } from "../models/Notification.js";
import { sendPushNotification } from "../services/pushService.js";
import { createUserNotification } from "../services/notificationService.js";

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

const getRideParticipantIds = async (rideId, driverId) => {
  const acceptedBookings = await Booking.find({
    rideId,
    status: { $in: ["accepted", "booked", "ongoing", "completed"] },
  }).select("passengerId");

  const passengerIds = acceptedBookings.map((item) => String(item.passengerId));
  return [...new Set([String(driverId), ...passengerIds])];
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

const toRad = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (a, b) => {
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

const RIDE_AUTO_COMPLETE_HOURS = Number(process.env.RIDE_AUTO_COMPLETE_HOURS || 6);
const FREE_CHAT_MESSAGE_LIMIT = 5;
const PHONE_REGEX = /(\+?\d[\d\s\-()]{7,}\d)/;
const WHATSAPP_LINK_REGEX = /(wa\.me\/|chat\.whatsapp\.com\/|whatsapp\.com\/)/i;

const containsLockedContactContent = (text) => {
  const value = String(text || "");
  return PHONE_REGEX.test(value) || WHATSAPP_LINK_REGEX.test(value);
};

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

export const initializeSocket = (httpServer) => {
  const origins = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: origins.length ? origins : true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id name role accountStatus");

      if (!user) {
        return next(new Error("Unauthorized"));
      }

      if (user.accountStatus === "banned" || user.accountStatus === "suspended") {
        return next(new Error("Unauthorized"));
      }

      socket.user = user;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    setUserOnline(socket.user._id);
    socket.join(String(socket.user._id));
    socket.join(`user:${String(socket.user._id)}`);

    socket.on("join_ride_room", async ({ rideId }) => {
      if (!rideId) {
        return;
      }

      const ride = await Ride.findById(rideId).select("driver status dateTime startTime");
      if (!ride) {
        return;
      }

      const participantIds = await getRideParticipantIds(rideId, ride.driver);
      if (!participantIds.includes(String(socket.user._id)) && socket.user.role !== "admin") {
        socket.emit("chat_locked", {
          rideId,
          message: "Only ride participants can join this chat.",
        });
        return;
      }

      socket.join(`ride:${rideId}`);
    });

    socket.on("send_message", async (payload) => {
      const { rideId, receiverId, text, clientMessageId } = payload || {};

      if (!rideId || !text?.trim()) {
        return;
      }

      const ride = await Ride.findById(rideId).select("driver status dateTime startTime");
      if (!ride) {
        return;
      }

      const chatStatus = await resolveRideStatusForChat(ride);

      if (["completed", "cancelled"].includes(String(chatStatus))) {
        socket.emit("chat_closed", {
          rideId,
          message: "This ride is completed. Chat is disabled.",
        });
        return;
      }

      if (chatStatus !== "live") {
        socket.emit("chat_locked", {
          rideId,
          message: "Chat is only available for live rides.",
        });
        return;
      }

      const participantIds = await getRideParticipantIds(rideId, ride.driver);
      if (!participantIds.includes(String(socket.user._id)) && socket.user.role !== "admin") {
        return;
      }

      const unlocked = await hasInteractionAccess(socket.user._id, rideId, socket.user.role);

      const normalizedReceiverId = receiverId ? String(receiverId) : null;
      if (normalizedReceiverId && !participantIds.includes(normalizedReceiverId)) {
        return;
      }

      const recipients = normalizedReceiverId
        ? [normalizedReceiverId]
        : participantIds.filter((id) => id !== String(socket.user._id));

      if (!recipients.length) {
        return;
      }

      if (!unlocked && containsLockedContactContent(text.trim())) {
        socket.emit("chat_locked", {
          rideId,
          message: "Phone numbers and WhatsApp links are blocked before payment unlock.",
        });
        return;
      }

      if (!unlocked) {
        const sentCount = await Message.countDocuments({ rideId, senderId: socket.user._id });
        if (sentCount >= FREE_CHAT_MESSAGE_LIMIT) {
          socket.emit("chat_locked", {
            rideId,
            message: "Free chat limit reached. Pay to unlock unlimited chat and contact.",
          });
          return;
        }
      }

      const blockedChecks = await Promise.all(recipients.map((targetId) => isConversationBlocked(socket.user._id, targetId)));
      if (blockedChecks.some(Boolean)) {
        socket.emit("chat_blocked", { rideId, receiverId: normalizedReceiverId });
        return;
      }

      const createdMessage = await Message.create({
        rideId,
        senderId: socket.user._id,
        receiverId: normalizedReceiverId || null,
        message: text.trim(),
        timestamp: new Date(),
        isSeen: false,
      });

      const populated = await Message.findById(createdMessage._id)
        .populate("senderId", "name role")
        .populate("receiverId", "name role");

      const messagePayload = mapMessagePayload(populated);
      messagePayload.clientMessageId = clientMessageId || null;

      io.to(`ride:${rideId}`).emit("receive_message", messagePayload);
      io.to(`ride:${rideId}`).emit("new_message", messagePayload);
      recipients.forEach((targetId) => {
        io.to(`user:${String(targetId)}`).emit("receive_message", messagePayload);
      });

      await Promise.all(
        recipients.map(async (targetId) => {
          await createUserNotification({
            userId: targetId,
            type: "message",
            title: "New message",
            body: `${socket.user.name} sent a message in ride chat`,
            data: { rideId, messageId: String(createdMessage._id) },
            pushFallback: false,
          });

          if (!isUserOnline(targetId)) {
            const receiver = await User.findById(targetId).select("fcmToken");
            await sendPushNotification({
              token: receiver?.fcmToken,
              title: `New message from ${socket.user.name}`,
              body: text.trim().slice(0, 80),
              data: { rideId, messageId: String(createdMessage._id) },
            });
          }
        })
      );

      socket.emit("message_sent", messagePayload);
    });

    socket.on("disconnect", () => {
      setUserOffline(socket.user._id);
    });

    socket.on("share_location", async (payload) => {
      const { rideId, latitude, longitude } = payload || {};

      if (!rideId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const now = new Date();
      const existing = await Location.findOne({ rideId, userId: socket.user._id }).sort({ updatedAt: -1 });

      if (existing && now.getTime() - new Date(existing.updatedAt).getTime() < 3000) {
        return;
      }

      const location = await Location.findOneAndUpdate(
        { rideId, userId: socket.user._id },
        { latitude, longitude, updatedAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const locationPayload = {
        rideId,
        userId: String(socket.user._id),
        latitude,
        longitude,
        updatedAt: location.updatedAt,
      };

      io.to(`ride:${rideId}`).emit("location:update", locationPayload);
      io.to(`ride:${rideId}`).emit("location:receive", locationPayload);
      io.to(`ride:${rideId}`).emit("location_update", locationPayload);

      const ride = await Ride.findById(rideId).select("driver fromCoordinates status");
      if (!ride || String(ride.driver) !== String(socket.user._id) || !ride.fromCoordinates || ride.status === "cancelled") {
        return;
      }

      const distanceKm = calculateDistanceKm(
        { lat: latitude, lng: longitude },
        { lat: ride.fromCoordinates.lat, lng: ride.fromCoordinates.lng }
      );

      if (distanceKm > 2) {
        return;
      }

      const pendingBookings = await Booking.find({ rideId, driverNearNotified: false, status: { $in: ["accepted", "booked", "ongoing"] } })
        .select("_id passengerId");

      if (!pendingBookings.length) {
        return;
      }

      await Booking.updateMany(
        { _id: { $in: pendingBookings.map((item) => item._id) } },
        { driverNearNotified: true }
      );

      const notifications = pendingBookings.map((booking) => ({
        user: booking.passengerId,
        type: "generic",
        title: "Driver near your pickup",
        body: "Your driver is approaching the pickup point.",
        data: { rideId },
      }));

      const created = await Notification.insertMany(notifications);

      created.forEach((item) => {
        io.to(`user:${String(item.user)}`).emit("new_notification", item);
      });
    });
  });

  setIo(io);
  return io;
};
