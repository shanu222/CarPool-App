import { Message } from "../models/Message.js";
import { Ride } from "../models/Ride.js";
import { Notification } from "../models/Notification.js";
import { sendPushNotification } from "../services/pushService.js";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { getIo } from "../socket/io.js";

const ensureRideParticipant = (ride, userId) => {
  const isDriver = String(ride.driver) === String(userId);
  return isDriver;
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

    if (!isDriver && !hasBooking) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const messages = await Message.find({ ride: rideId })
      .populate("sender", "name role")
      .populate("receiver", "name role")
      .sort({ createdAt: 1 });

    return res.json(messages);
  } catch (error) {
    return next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { rideId, receiverId, text } = req.body;

    if (!rideId || !receiverId || !text?.trim()) {
      return res.status(400).json({ message: "rideId, receiverId and text are required" });
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

    if (!isDriver && !hasBooking) {
      return res.status(403).json({ message: "Only ride participants can chat" });
    }

    const message = await Message.create({
      ride: rideId,
      sender: req.user._id,
      receiver: receiverId,
      text: text.trim(),
    });

    const populated = await Message.findById(message._id)
      .populate("sender", "name role")
      .populate("receiver", "name role");

    const io = getIo();
    if (io) {
      io.to(`ride:${rideId}`).emit("new_message", populated);
    }

    await Notification.create({
      user: receiverId,
      type: "message",
      title: "New message",
      body: `${req.user.name} sent you a message`,
      data: { rideId, messageId: message._id },
    });

    const receiver = await User.findById(receiverId).select("fcmToken");

    await sendPushNotification({
      token: receiver?.fcmToken,
      title: "New message",
      body: `${req.user.name}: ${text.trim().slice(0, 80)}`,
      data: { rideId, messageId: String(message._id) },
    });

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};
