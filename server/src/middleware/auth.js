import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session expired. Please login again" });
    }

    if (user.accountStatus === "banned") {
      return res.status(403).json({ message: "Account is banned" });
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({ message: user.suspensionReason || "Account is suspended" });
    }

    if (user.isDeleted) {
      return res.status(403).json({ message: "Account is deleted" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  return next();
};

export const requireDriver = (req, res, next) => {
  if (!req.user || req.user.role !== "driver") {
    return res.status(403).json({ message: "Drivers only" });
  }

  return next();
};

export const requirePassenger = (req, res, next) => {
  if (!req.user || req.user.role !== "passenger") {
    return res.status(403).json({ message: "Passengers only" });
  }

  return next();
};
