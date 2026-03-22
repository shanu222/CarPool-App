import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) => getAdminEmails().includes((email || "").toLowerCase());

const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountStatus: user.accountStatus,
  suspensionReason: user.suspensionReason,
  rating: user.rating,
  isVerified: user.isVerified,
  verificationStatus: user.verificationStatus,
  cnicNumber: user.cnicNumber || user.cnic,
  cnic: user.cnic,
  cnicPhoto: user.cnicPhoto || user.licensePhoto,
  profilePhoto: user.profilePhoto,
  licensePhoto: user.licensePhoto,
  ratingCount: user.ratingCount,
  canPostRide: user.canPostRide,
  canBookRide: user.canBookRide,
  canChat: user.canChat,
});

export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        ...(phone ? [{ phone: phone.trim() }] : []),
      ],
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedEmail = email.toLowerCase().trim();
    const finalRole = isAdminEmail(normalizedEmail) ? "admin" : role === "driver" ? "driver" : "passenger";

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : undefined,
      password: hashedPassword,
      role: finalRole,
      canPostRide: finalRole === "admin",
      canBookRide: finalRole === "admin",
      canChat: finalRole === "admin",
      accountStatus: "active",
      verificationStatus: finalRole === "admin" ? "approved" : "none",
      isVerified: finalRole === "admin",
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    if (user.accountStatus === "banned") {
      return res.status(403).json({ message: "Account is banned" });
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({ message: user.suspensionReason || "Account is suspended" });
    }

    if (isAdminEmail(user.email) && user.role !== "admin") {
      user.role = "admin";
      user.canPostRide = true;
      user.canBookRide = true;
      user.canChat = true;
      user.isVerified = true;
      user.verificationStatus = "approved";
      await user.save();
    }

    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};
