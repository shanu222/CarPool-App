import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { setIo } from "./io.js";
import { Location } from "../models/Location.js";
import { Ride } from "../models/Ride.js";
import { Booking } from "../models/Booking.js";
import { Notification } from "../models/Notification.js";

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
      const user = await User.findById(decoded.id).select("_id name role");

      if (!user) {
        return next(new Error("Unauthorized"));
      }

      socket.user = user;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${String(socket.user._id)}`);

    socket.on("join_ride_room", ({ rideId }) => {
      if (!rideId) {
        return;
      }

      socket.join(`ride:${rideId}`);
    });

    socket.on("send_message", async (payload) => {
      const { rideId, receiverId, text } = payload || {};

      if (!rideId || !receiverId || !text?.trim()) {
        return;
      }

      const ride = await Ride.findById(rideId).select("driver");
      if (!ride) {
        return;
      }

      const isDriver = String(ride.driver) === String(socket.user._id);
      const hasAcceptedBooking = await Booking.exists({
        rideId,
        passengerId: socket.user._id,
        status: { $in: ["accepted", "ongoing", "completed"] },
      });

      if (!isDriver && !hasAcceptedBooking) {
        return;
      }

      const message = await Message.create({
        ride: rideId,
        sender: socket.user._id,
        receiver: receiverId,
        text: text.trim(),
      });

      const populated = await Message.findById(message._id)
        .populate("sender", "name role")
        .populate("receiver", "name role");

      io.to(`ride:${rideId}`).emit("new_message", populated);
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

      io.to(`ride:${rideId}`).emit("location_update", {
        rideId,
        userId: String(socket.user._id),
        latitude,
        longitude,
        updatedAt: location.updatedAt,
      });

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

      const pendingBookings = await Booking.find({ rideId, driverNearNotified: false, status: { $in: ["accepted", "ongoing"] } })
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
