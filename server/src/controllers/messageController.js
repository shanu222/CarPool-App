import { Message } from "../models/Message.js";
import { Ride } from "../models/Ride.js";
import { Notification } from "../models/Notification.js";
import { sendPushNotification } from "../services/pushService.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { getIo } from "../socket/io.js";
import { isUserOnline } from "../socket/io.js";

const ensureRideParticipant = (ride, userId) => {
  const isDriver = String(ride.driver) === String(userId);
  return isDriver;
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

export const getRideMessages = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId).select("driver");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const hasBooking = await Booking.exists({
      rideId,
      passengerId: req.user._id,
      status: { $in: ["accepted", "ongoing", "completed"] },
    });
    const isDriver = ensureRideParticipant(ride, req.user._id);

    if (!isDriver && req.user?.role !== "passenger") {
      return res.status(403).json({ message: "Passengers only" });
    }

    if (req.user?.role !== "admin" && !req.user?.canChat) {
      return res.status(403).json({ message: "Chat is locked. Submit payment proof for booking/chat subscription." });
    }

    if (!isDriver && !hasBooking) {
      return res.status(403).json({ message: "Forbidden" });
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

    return res.json(messages.map(mapMessagePayload));
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

    if (!rideId || !receiverId || !normalizedText) {
      return res.status(400).json({ message: "rideId, receiverId and message are required" });
    }

    const ride = await Ride.findById(rideId).populate("driver", "_id name fcmToken");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const isDriver = String(ride.driver._id) === String(req.user._id);
    const hasBooking = await Booking.exists({
      rideId,
      passengerId: req.user._id,
      status: { $in: ["accepted", "ongoing", "completed"] },
    });

    if (!isDriver && req.user?.role !== "passenger") {
      return res.status(403).json({ message: "Passengers only" });
    }

    if (req.user?.role !== "admin" && !req.user?.canChat) {
      return res.status(403).json({ message: "Chat is locked. Submit payment proof for booking/chat subscription." });
    }

    if (!isDriver && !hasBooking) {
      return res.status(403).json({ message: "Only ride participants can chat" });
    }

    const createdMessage = await Message.create({
      rideId,
      senderId: req.user._id,
      receiverId,
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
      io.to(`user:${String(receiverId)}`).emit("receive_message", payload);
    }

    await Notification.create({
      user: receiverId,
      type: "message",
      title: "New message",
      body: `${req.user.name} sent you a message`,
      data: { rideId, messageId: createdMessage._id },
    });

    if (!isUserOnline(receiverId)) {
      const receiver = await User.findById(receiverId).select("fcmToken");

      await sendPushNotification({
        token: receiver?.fcmToken,
        title: `New message from ${req.user.name}`,
        body: normalizedText.slice(0, 80),
        data: { rideId, messageId: String(createdMessage._id) },
      });
    }

    return res.status(201).json(payload);
  } catch (error) {
    return next(error);
  }
};
