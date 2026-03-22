import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { setIo } from "./io.js";

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
  });

  setIo(io);
  return io;
};
