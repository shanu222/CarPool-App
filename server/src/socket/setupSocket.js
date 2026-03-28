import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { setIo, setUserOffline, setUserOnline, isUserOnline } from "./io.js";
import { Location } from "../models/Location.js";
import { Ride } from "../models/Ride.js";
import { Booking } from "../models/Booking.js";
import { Match } from "../models/Match.js";
import { Notification } from "../models/Notification.js";
import { sendPushNotification } from "../services/pushService.js";
import { createUserNotification } from "../services/notificationService.js";
import { areUsersBlocked } from "../utils/blocking.js";

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

const getRideParticipantIds = async (rideId, driverId) => {
  const acceptedBookings = await Booking.find({
    rideId,
    status: { $in: ["accepted", "booked", "ongoing", "completed"] },
  }).select("passengerId");

  const passengerIds = acceptedBookings.map((item) => String(item.passengerId));
  const approvedMatches = await Match.find({ rideId, status: "approved" }).select("passengerId");
  const matchedPassengerIds = approvedMatches.map((item) => String(item.passengerId));
  return [...new Set([String(driverId), ...passengerIds, ...matchedPassengerIds])];
};

const getApprovedMatchForUser = async (rideId, userId) => {
  return Match.findOne({
    rideId,
    status: "approved",
    $or: [{ driverId: userId }, { passengerId: userId }],
  });
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

const hasBlockedParticipants = async (rideId, driverId, currentUserId) => {
  const participantIds = await getRideParticipantIds(rideId, driverId);
  const otherParticipantIds = participantIds.filter((id) => String(id) !== String(currentUserId));

  if (!otherParticipantIds.length) {
    return false;
  }

  const checks = await Promise.all(otherParticipantIds.map((id) => areUsersBlocked(currentUserId, id)));
  return checks.some(Boolean);
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

      const approvedMatch = await getApprovedMatchForUser(rideId, socket.user._id);
      if (String(ride.status) === "matched" && !approvedMatch && socket.user.role !== "admin") {
        socket.emit("chat_locked", {
          rideId,
          message: "Chat is available only after both users approve the match.",
        });
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

      if (socket.user.role !== "admin") {
        const blocked = await hasBlockedParticipants(rideId, ride.driver, socket.user._id);
        if (blocked) {
          socket.emit("chat_blocked", {
            rideId,
            message: "Chat unavailable due to block settings.",
          });
          return;
        }
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

      const approvedMatch = await getApprovedMatchForUser(rideId, socket.user._id);
      const isMatchedRide = String(ride.status) === "matched";

      if (isMatchedRide && !approvedMatch && socket.user.role !== "admin") {
        socket.emit("chat_locked", {
          rideId,
          message: "Chat is available only after both users approve the match.",
        });
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

      if (!isMatchedRide && !["live", "scheduled", "nearby"].includes(String(chatStatus))) {
        socket.emit("chat_locked", {
          rideId,
          message: "Chat is only available for live and scheduled rides.",
        });
        return;
      }

      const participantIds = await getRideParticipantIds(rideId, ride.driver);
      if (!participantIds.includes(String(socket.user._id)) && socket.user.role !== "admin") {
        return;
      }

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

      const blockedChecks = await Promise.all(recipients.map((targetId) => areUsersBlocked(socket.user._id, targetId)));
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
        io.to(`user:${String(targetId)}`).emit("new_message", messagePayload);
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
