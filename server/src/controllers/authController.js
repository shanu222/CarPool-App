import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { User } from "../models/User.js";

const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) => getAdminEmails().includes((email || "").toLowerCase());

const ADMIN_MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 5);
const ADMIN_LOCK_WINDOW_MS = Number(process.env.ADMIN_LOGIN_LOCK_MINUTES || 15) * 60 * 1000;
const ADMIN_FAIL_DELAY_MS = Number(process.env.ADMIN_LOGIN_FAIL_DELAY_MS || 700);
const adminLoginAttempts = new Map();

const normalizeEmail = (value) => (value || "").trim().toLowerCase();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || "unknown";
};

const getAttemptKey = (req, email) => `${getClientIp(req)}:${normalizeEmail(email)}`;

const clearOldAttempts = (record, now) => {
  if (!record) {
    return;
  }

  if (record.lockedUntil && record.lockedUntil <= now) {
    record.lockedUntil = 0;
    record.count = 0;
  }

  if (record.firstFailureAt && now - record.firstFailureAt > ADMIN_LOCK_WINDOW_MS) {
    record.count = 0;
    record.firstFailureAt = 0;
  }
};

const registerAdminFailure = (key) => {
  const now = Date.now();
  const record = adminLoginAttempts.get(key) || { count: 0, firstFailureAt: now, lockedUntil: 0 };

  clearOldAttempts(record, now);

  if (!record.firstFailureAt) {
    record.firstFailureAt = now;
  }

  record.count += 1;

  if (record.count >= ADMIN_MAX_ATTEMPTS) {
    record.lockedUntil = now + ADMIN_LOCK_WINDOW_MS;
    record.count = 0;
    record.firstFailureAt = 0;
  }

  adminLoginAttempts.set(key, record);
};

const isAdminLockedOut = (key) => {
  const now = Date.now();
  const record = adminLoginAttempts.get(key);

  if (!record) {
    return false;
  }

  clearOldAttempts(record, now);
  adminLoginAttempts.set(key, record);
  return Boolean(record.lockedUntil && record.lockedUntil > now);
};

const resetAdminAttempts = (key) => {
  adminLoginAttempts.delete(key);
};

const timingSafeMatch = (left, right) => {
  const leftBuffer = Buffer.from(left || "", "utf8");
  const rightBuffer = Buffer.from(right || "", "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getConfiguredAdminCredential = () => {
  const singleEmail = normalizeEmail(process.env.ADMIN_LOGIN_EMAIL || process.env.ADMIN_EMAIL || "");
  const listEmails = getAdminEmails();
  const emails = [...new Set([singleEmail, ...listEmails].filter(Boolean))];
  const password = process.env.ADMIN_LOGIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
  const passwordHash = process.env.ADMIN_LOGIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD_HASH || "";

  return {
    emails,
    password,
    passwordHash,
  };
};

const verifyAdminSecret = async (inputPassword, configuredPassword, configuredPasswordHash) => {
  if (configuredPasswordHash) {
    return bcrypt.compare(inputPassword, configuredPasswordHash);
  }

  return timingSafeMatch(inputPassword, configuredPassword);
};

const getResetEmailTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user,
      pass,
    },
  });
};

const sendResetEmail = async ({ to, resetUrl, token }) => {
  const transport = getResetEmailTransport();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  if (!transport || !from) {
    return false;
  }

  await transport.sendMail({
    from,
    to,
    subject: "Reset your Carpool password",
    text: resetUrl
      ? `Reset your password using this link: ${resetUrl}`
      : `Use this reset token: ${token}`,
    html: resetUrl
      ? `<p>Reset your password using this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
      : `<p>Use this reset token:</p><p><strong>${token}</strong></p>`,
  });

  return true;
};

const signToken = (user, expiresIn = "7d") => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn,
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
  carPhoto: user.carPhoto,
  carMake: user.carMake,
  carModel: user.carModel,
  carColor: user.carColor,
  carPlateNumber: user.carPlateNumber,
  carYear: user.carYear,
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

    const normalizedEmail = normalizeEmail(email);
    const configuredAdmin = getConfiguredAdminCredential();

    if (configuredAdmin.emails.includes(normalizedEmail)) {
      await sleep(ADMIN_FAIL_DELAY_MS);
      return res.status(403).json({ message: "Use the admin login portal" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    if (user.role === "admin") {
      await sleep(ADMIN_FAIL_DELAY_MS);
      return res.status(403).json({ message: "Use the admin login portal" });
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

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const configuredAdmin = getConfiguredAdminCredential();

    if (configuredAdmin.emails.length === 0 || (!configuredAdmin.password && !configuredAdmin.passwordHash)) {
      return res.status(503).json({ message: "Admin login is not configured" });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedInputEmail = normalizeEmail(email);
    const key = getAttemptKey(req, normalizedInputEmail);

    if (isAdminLockedOut(key)) {
      return res.status(429).json({ message: "Too many attempts. Try again later" });
    }

    const emailMatches = configuredAdmin.emails.some((emailOption) =>
      timingSafeMatch(normalizedInputEmail, emailOption)
    );
    const passwordMatches =
      emailMatches &&
      (await verifyAdminSecret(password, configuredAdmin.password, configuredAdmin.passwordHash));

    if (!emailMatches || !passwordMatches) {
      registerAdminFailure(key);
      await sleep(ADMIN_FAIL_DELAY_MS);
      return res.status(401).json({ message: "Authentication failed" });
    }

    resetAdminAttempts(key);

    let user = await User.findOne({ email: normalizedInputEmail });

    if (!user) {
      const fallbackHash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = await User.create({
        name: "Administrator",
        email: normalizedInputEmail,
        password: fallbackHash,
        role: "admin",
        accountStatus: "active",
        verificationStatus: "approved",
        isVerified: true,
        canPostRide: true,
        canBookRide: true,
        canChat: true,
      });
    } else {
      let changed = false;

      if (user.role !== "admin") {
        user.role = "admin";
        changed = true;
      }

      if (user.accountStatus !== "active") {
        user.accountStatus = "active";
        user.suspensionReason = "";
        changed = true;
      }

      if (!user.isVerified || user.verificationStatus !== "approved") {
        user.isVerified = true;
        user.verificationStatus = "approved";
        changed = true;
      }

      if (!user.canPostRide || !user.canBookRide || !user.canChat) {
        user.canPostRide = true;
        user.canBookRide = true;
        user.canChat = true;
        changed = true;
      }

      if (changed) {
        await user.save();
      }
    }

    const adminTokenTtl = process.env.ADMIN_JWT_EXPIRES_IN || "8h";
    const token = signToken(user, adminTokenTtl);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    // Always return the same response to avoid account enumeration.
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const resetMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 20);
    const expiresAt = new Date(Date.now() + resetMinutes * 60 * 1000);

    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = expiresAt;
    await user.save();

    const frontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)[0];
    const resetUrl = frontendBase
      ? `${frontendBase.replace(/\/$/, "")}/auth?mode=reset&token=${rawToken}&email=${encodeURIComponent(
          normalizedEmail
        )}`
      : "";

    const emailSent = await sendResetEmail({ to: normalizedEmail, resetUrl, token: rawToken });

    if (process.env.NODE_ENV !== "production") {
      return res.json({
        message: "If that email exists, a reset link has been sent",
        resetToken: rawToken,
        resetUrl,
        emailSent,
      });
    }

    return res.json({ message: "If that email exists, a reset link has been sent" });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "email, token and newPassword are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    const normalizedEmail = normalizeEmail(email);
    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

    const user = await User.findOne({
      email: normalizedEmail,
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    return next(error);
  }
};
