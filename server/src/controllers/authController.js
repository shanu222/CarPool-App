import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { User } from "../models/User.js";
import { compareFaceWithSelfie, extractCnicDataFromImages } from "../services/kycVerificationService.js";
import { compareFaces } from "../services/faceService.js";
import { extractCnicData, extractLicenseNumber } from "../services/ocrService.js";
import { isNameMatch, isSameDate, normalizeCnic, normalizeDob, normalizeName } from "../utils/kycUtils.js";

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

// Normalize Pakistan numbers to +92XXXXXXXXXX for consistent signup/login matching.
export function normalizeNumber(number) {
  const digitsOnly = String(number || "").replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  let normalizedDigits = digitsOnly;

  if (normalizedDigits.startsWith("00")) {
    normalizedDigits = normalizedDigits.slice(2);
  }

  if (normalizedDigits.startsWith("92")) {
    const localPart = normalizedDigits.slice(2);
    if (localPart.length === 10) {
      return `+92${localPart}`;
    }
  }

  if (normalizedDigits.startsWith("0") && normalizedDigits.length === 11) {
    return `+92${normalizedDigits.slice(1)}`;
  }

  if (normalizedDigits.length === 10) {
    return `+92${normalizedDigits}`;
  }

  return "";
}

const normalizePhone = (value) => normalizeNumber(value);
const normalizeLicenseNumber = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

const buildFilePath = (req, file) => {
  if (!file?.filename) {
    return "";
  }

  return `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
};

const toStoredUploadPath = (file) => (file?.path ? file.path : "");

const jsonError = (res, status, error) => res.status(status).json({ success: false, error });
const jsonSuccess = (res, status, payload) => res.status(status).json({ success: true, ...payload });

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
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
};

const FORGOT_OTP_EXPIRY_MINUTES = 5;
const FORGOT_OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.FORGOT_OTP_RESEND_COOLDOWN_SECONDS || 60);
const FORGOT_OTP_VERIFIED_SESSION_MINUTES = Number(process.env.FORGOT_OTP_VERIFIED_SESSION_MINUTES || 10);

const sendOtpEmail = async ({ to, otp }) => {
  const transport = getResetEmailTransport();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER;

  if (!to) {
    return false;
  }

  if (!transport || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Mock Email OTP for ${to}: ${otp}`);
      return true;
    }
    return false;
  }

  await transport.sendMail({
    from,
    to,
    subject: "Your Carpool password reset OTP",
    text: `Use this OTP to reset your password: ${otp}. It expires in ${FORGOT_OTP_EXPIRY_MINUTES} minutes.`,
    html: `<p>Use this OTP to reset your password:</p><p><strong style="font-size:20px;letter-spacing:2px;">${otp}</strong></p><p>This OTP expires in ${FORGOT_OTP_EXPIRY_MINUTES} minutes.</p>`,
  });

  return true;
};

const sendOtpSms = async ({ to, otp }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from || !to) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Mock SMS OTP for ${to}: ${otp}`);
      return true;
    }
    return false;
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `Your Carpool password reset OTP is ${otp}. Expires in ${FORGOT_OTP_EXPIRY_MINUTES} minutes.`,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return response.ok;
};

const signToken = (user, expiresIn = "7d") => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  maskedPhone: user.phone ? `${String(user.phone).slice(0, 4)}****${String(user.phone).slice(-3)}` : undefined,
  role: user.role,
  status: user.status,
  isBlocked: user.isBlocked,
  accountStatus: user.accountStatus,
  suspensionReason: user.suspensionReason,
  rating: user.rating,
  isVerified: user.isVerified,
  isFeatured: Boolean(user.isFeatured),
  verificationStatus: user.verificationStatus,
  cnicNumber: user.cnicNumber,
  dob: user.dob,
  cnicFrontImage: user.cnicFrontImage,
  cnicBackImage: user.cnicBackImage,
  selfieImage: user.selfieImage,
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
  paymentApproved: user.paymentApproved,
  blockedUsers: user.blockedUsers || [],
  notificationSettings: {
    messages: user.notificationSettings?.messages !== false,
    rides: user.notificationSettings?.rides !== false,
    payments: user.notificationSettings?.payments !== false,
  },
});

const minimalLoginUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  rating: Number(user.rating || 0),
  isVerified: Boolean(user.isVerified),
  verificationStatus: user.verificationStatus,
});

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ""));

const verifyPasswordAndMigrateIfNeeded = async (user, plainPassword) => {
  const storedPassword = String(user?.password || "");
  const candidate = String(plainPassword || "");

  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(candidate, storedPassword);
  }

  const plainMatch = storedPassword === candidate;

  if (plainMatch) {
    user.password = await bcrypt.hash(candidate, 10);
    await user.save();
  }

  return plainMatch;
};

export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "old password and new password are required" });
    }

    if (String(newPassword).trim().length < 6) {
      return res.status(400).json({ message: "new password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(String(oldPassword), user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    user.password = await bcrypt.hash(String(newPassword).trim(), 10);
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    return next(error);
  }
};

export const logoutAllDevices = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();

    return res.json({ message: "Logged out from all devices" });
  } catch (error) {
    return next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, cnicNumber, dob } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = normalizePhone(phone);
    const selectedRole = String(role || "").trim();
    const finalRole = isAdminEmail(normalizedEmail) ? "admin" : selectedRole;

    if (finalRole !== "admin" && !["passenger", "driver"].includes(selectedRole)) {
      return res.status(400).json({ message: "role must be passenger or driver" });
    }

    const existingEmailRole = await User.findOne({ email: normalizedEmail, role: finalRole });
    if (existingEmailRole) {
      return res.status(409).json({ message: "Account already exists for this role" });
    }

    if (normalizedPhone) {
      const existingPhoneRole = await User.findOne({ phone: normalizedPhone, role: finalRole });
      if (existingPhoneRole) {
        return res.status(409).json({ message: "Account already exists for this role" });
      }
    }

    const normalizedInputCnic = normalizeCnic(cnicNumber);
    const normalizedInputDob = normalizeDob(dob);

    if (finalRole !== "admin") {
      if (!normalizedInputCnic) {
        return res.status(400).json({ message: "Valid cnicNumber is required" });
      }

      if (!normalizedInputDob) {
        return res.status(400).json({ message: "Valid dob is required in YYYY-MM-DD format" });
      }

      const existingCnic = await User.findOne({ cnicNumber: normalizedInputCnic });
      if (existingCnic) {
        return res.status(409).json({ message: "Account already exists for this CNIC" });
      }

      const cnicFrontFile = req.files?.cnicFrontImage?.[0];
      const cnicBackFile = req.files?.cnicBackImage?.[0];
      const selfieFile = req.files?.selfieImage?.[0];

      if (!cnicFrontFile || !cnicBackFile || !selfieFile) {
        return res
          .status(400)
          .json({ message: "cnicFrontImage, cnicBackImage and selfieImage are required" });
      }

      const ocrResult = await extractCnicDataFromImages({
        cnicFrontPath: toStoredUploadPath(cnicFrontFile),
        cnicBackPath: toStoredUploadPath(cnicBackFile),
      });

      if (!ocrResult.success) {
        return res.status(400).json({ message: ocrResult.errorMessage || "Unable to extract CNIC data" });
      }

      const extractedName = ocrResult.parsed.name;
      const extractedCnic = normalizeCnic(ocrResult.parsed.cnic);
      const extractedDob = normalizeDob(ocrResult.parsed.dob);

      if (normalizedInputCnic !== extractedCnic) {
        return res.status(400).json({ message: "CNIC mismatch" });
      }

      if (!isSameDate(normalizedInputDob, extractedDob)) {
        return res.status(400).json({ message: "DOB does not match" });
      }

      if (!isNameMatch(normalizeName(name), extractedName)) {
        return res.status(400).json({ message: "Name does not match CNIC" });
      }

      const faceResult = await compareFaceWithSelfie({
        cnicFrontPath: toStoredUploadPath(cnicFrontFile),
        selfiePath: toStoredUploadPath(selfieFile),
        threshold: Number(process.env.FACE_MATCH_THRESHOLD || 80),
      });

      if (!faceResult.matched) {
        return res.status(400).json({ message: "Face verification failed" });
      }

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone || undefined,
        password: hashedPassword,
        role: finalRole,
        cnicNumber: normalizedInputCnic,
        cnic: normalizedInputCnic,
        dob: normalizedInputDob,
        cnicFrontImage: buildFilePath(req, cnicFrontFile),
        cnicBackImage: buildFilePath(req, cnicBackFile),
        selfieImage: buildFilePath(req, selfieFile),
        status: "approved",
        isBlocked: false,
        canPostRide: false,
        canBookRide: false,
        canChat: false,
        accountStatus: "active",
        verificationStatus: "verified",
        isVerified: true,
      });

      const token = signToken(user);
      return res.status(201).json({ token, user: sanitizeUser(user) });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone || undefined,
      password: hashedPassword,
      role: finalRole,
      status: finalRole === "admin" ? "approved" : "pending",
      isBlocked: false,
      canPostRide: finalRole === "admin",
      canBookRide: finalRole === "admin",
      canChat: finalRole === "admin",
      accountStatus: "active",
      verificationStatus: finalRole === "admin" ? "verified" : "pending",
      isVerified: finalRole === "admin",
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

const strictSignup = async ({ req, res, role }) => {
  const { name, dob, cnic, mobile, password, licenseNumber } = req.body;

  if (!name || !dob || !cnic || !mobile || !password) {
    return jsonError(res, 400, "Missing required fields");
  }

  const normalizedCnic = normalizeCnic(cnic);
  const normalizedDob = normalizeDob(dob);
  const normalizedMobile = normalizePhone(mobile);

  if (!normalizedCnic) {
    return jsonError(res, 400, "CNIC number does not match");
  }

  if (!normalizedDob) {
    return jsonError(res, 400, "DOB does not match CNIC");
  }

  const profileImageFile = req.files?.profileImage?.[0];
  const cnicFrontFile = req.files?.cnicFront?.[0];
  const cnicBackFile = req.files?.cnicBack?.[0];
  const licenseImageFile = req.files?.licenseImage?.[0];

  if (!profileImageFile || !cnicFrontFile || !cnicBackFile) {
    return jsonError(res, 400, "Missing required verification images");
  }

  if (role === "driver" && (!licenseNumber || !licenseImageFile)) {
    return jsonError(res, 400, "License number invalid");
  }

  const duplicate = await User.findOne({
    $or: [{ cnicNumber: normalizedCnic }, { cnic: normalizedCnic }, { phone: normalizedMobile }],
  });

  if (duplicate) {
    return jsonError(res, 409, "Account already exists");
  }

  const cnicData = await extractCnicData({
    cnicFrontPath: toStoredUploadPath(cnicFrontFile),
    cnicBackPath: toStoredUploadPath(cnicBackFile),
  });

  if (!cnicData?.cnic || normalizeCnic(cnicData.cnic) !== normalizedCnic) {
    return jsonError(res, 400, "CNIC number does not match");
  }

  if (!cnicData?.name || !isNameMatch(normalizeName(name), cnicData.name)) {
    return jsonError(res, 400, "Name does not match CNIC");
  }

  if (!cnicData?.dob || !isSameDate(normalizedDob, cnicData.dob)) {
    return jsonError(res, 400, "DOB does not match CNIC");
  }

  if (role === "driver") {
    const extractedLicense = await extractLicenseNumber(toStoredUploadPath(licenseImageFile));

    if (!extractedLicense || normalizeLicenseNumber(extractedLicense) !== normalizeLicenseNumber(licenseNumber)) {
      return jsonError(res, 400, "License number invalid");
    }
  }

  const faceResult = await compareFaces(
    toStoredUploadPath(cnicFrontFile),
    toStoredUploadPath(profileImageFile),
    Number(process.env.FACE_MATCH_THRESHOLD || 80)
  );

  if (!faceResult?.matched) {
    return jsonError(res, 400, "Face does not match CNIC");
  }

  const normalizedEmail = `${normalizedMobile.replace(/[^\d+]/g, "")}.${role}@noemail.local`;
  const hashedPassword = await bcrypt.hash(password, 10);

  await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    phone: normalizedMobile,
    password: hashedPassword,
    role,
    cnicNumber: normalizedCnic,
    cnic: normalizedCnic,
    dob: normalizedDob,
    selfieImage: buildFilePath(req, profileImageFile),
    profilePhoto: buildFilePath(req, profileImageFile),
    cnicFrontImage: buildFilePath(req, cnicFrontFile),
    cnicBackImage: buildFilePath(req, cnicBackFile),
    licensePhoto: role === "driver" ? buildFilePath(req, licenseImageFile) : "",
    cnicPhoto: role === "driver" ? buildFilePath(req, licenseImageFile) : "",
    status: "approved",
    accountStatus: "active",
    verificationStatus: "verified",
    isVerified: true,
    verified: true,
  });

  return jsonSuccess(res, 201, {
    message: "Account created successfully. Please login.",
  });
};

export const passengerSignup = async (req, res, next) => {
  try {
    return await strictSignup({ req, res, role: "passenger" });
  } catch (error) {
    return jsonError(res, 400, error?.message || "Verification failed");
  }
};

export const driverSignup = async (req, res, next) => {
  try {
    return await strictSignup({ req, res, role: "driver" });
  } catch (error) {
    return jsonError(res, 400, error?.message || "Verification failed");
  }
};

export const publicSignup = async (req, res, next) => {
  try {
    const requestedRole = String(req.body?.role || "").trim().toLowerCase();

    if (!requestedRole || !["passenger", "driver"].includes(requestedRole)) {
      return jsonError(res, 400, "role must be passenger or driver");
    }

    return await strictSignup({ req, res, role: requestedRole });
  } catch (error) {
    return next(error);
  }
};

export const publicLogin = async (req, res, next) => {
  try {
    const { mobile, password, role, identifier, email, phone } = req.body;

    const phoneInput = mobile || phone || identifier;
    const normalizedMobile = normalizeNumber(phoneInput);
    const inputIdentifier = normalizedMobile || String(identifier || email || "").trim();
    const emailCandidate = inputIdentifier.includes("@")
      ? inputIdentifier.toLowerCase()
      : String(email || "").trim().toLowerCase();

    console.log("[AUTH][LOGIN] Input:", {
      role,
      mobile,
      phone,
      identifier,
      normalizedMobile,
      hasPassword: Boolean(password),
    });

    if (!inputIdentifier || !password) {
      return jsonError(res, 400, "Mobile/email and password are required");
    }

    const lookupConditions = normalizedMobile ? [{ phone: normalizedMobile }] : [];

    if (!inputIdentifier.includes("@") && !normalizedMobile) {
      return jsonError(res, 400, "Invalid mobile number format");
    }

    if (emailCandidate) {
      lookupConditions.push({ email: emailCandidate });
    }

    const selector = {
      $or: lookupConditions,
      ...(role ? { role } : { role: { $in: ["passenger", "driver"] } }),
    };

    const user = await User.findOne(selector);

    console.log("[AUTH][LOGIN] User from DB:", {
      found: Boolean(user),
      id: user?._id,
      role: user?.role,
      phone: user?.phone,
      hasPassword: Boolean(user?.password),
    });

    if (!user) {
      return jsonError(res, 404, "User not found");
    }

    const passwordMatch = await verifyPasswordAndMigrateIfNeeded(user, String(password));

    if (!passwordMatch) {
      return jsonError(res, 401, "Invalid password");
    }

    if (user.verified !== true) {
      return jsonError(res, 403, "Account not verified");
    }

    const token = signToken(user);

    return jsonSuccess(res, 200, {
      message: "Login successful",
      token,
      user: minimalLoginUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, phone, identifier, password, role } = req.body;

    if (!password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const rawIdentifier = String(identifier || email || phone || "").trim();
    const explicitEmail = String(email || "").trim();
    const explicitPhone = normalizeNumber(phone || "");

    const emailCandidate = normalizeEmail(explicitEmail || (rawIdentifier.includes("@") ? rawIdentifier : ""));
    const phoneCandidate = explicitPhone || (!rawIdentifier.includes("@") ? normalizeNumber(rawIdentifier) : "");

    const identifierConditions = [
      ...(emailCandidate ? [{ email: emailCandidate }] : []),
      ...(phoneCandidate ? [{ phone: phoneCandidate }] : []),
    ];

    if (identifierConditions.length === 0) {
      return res.status(400).json({ message: "email or phone is required" });
    }

    if (role && !["passenger", "driver"].includes(role)) {
      return res.status(400).json({ message: "role must be passenger or driver" });
    }

    const normalizedEmail = emailCandidate;
    const configuredAdmin = getConfiguredAdminCredential();

    if (normalizedEmail && configuredAdmin.emails.includes(normalizedEmail)) {
      await sleep(ADMIN_FAIL_DELAY_MS);
      return res.status(403).json({ message: "Use the admin login portal" });
    }

    const roleSelector = role ? { role } : { role: { $in: ["passenger", "driver"] } };
    const candidates = await User.find({ ...roleSelector, $or: identifierConditions }).limit(2);

    if (!role && candidates.length > 1) {
      return res.status(400).json({ message: "Multiple accounts found. Please provide role" });
    }

    const user = candidates[0];

    if (!user) {
      return res.status(404).json({ message: "No account found for selected role" });
    }

    const passwordMatch = await verifyPasswordAndMigrateIfNeeded(user, password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "This account is blocked for selected role" });
    }

    const isVerificationApproved =
      user.isVerified === true && ["verified", "approved"].includes(String(user.verificationStatus || ""));

    if (!isVerificationApproved) {
      return res.status(403).json({ message: "Account is not verified" });
    }

    if (user.status === "pending") {
      return res.status(403).json({ message: "Your account is pending admin approval" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ message: user.suspensionReason || "Account is suspended" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ message: "Account is banned" });
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
      user.paymentApproved = true;
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
        user.paymentApproved = true;
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
    const { email, phone, role } = req.body;

    const normalizedEmail = email ? normalizeEmail(email) : "";
    const normalizedPhone = phone ? String(phone).trim() : "";
    const requestedRole = String(role || "").trim();

    if (!normalizedEmail && !normalizedPhone) {
      return res.status(400).json({ message: "email or phone is required" });
    }

    if (requestedRole && !["driver", "passenger"].includes(requestedRole)) {
      return res.status(400).json({ message: "role must be driver or passenger" });
    }

    const identifierConditions = [
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ];

    const matches = await User.find({
      role: { $in: ["driver", "passenger"] },
      $or: identifierConditions,
    }).select("+otp +otpExpiry +otpResendAvailableAt +resetSessionToken +resetSessionExpiry +resetToken +resetTokenExpiry");

    if (!matches.length) {
      return res.status(404).json({ message: "No account found for provided email or phone" });
    }

    if (!requestedRole && matches.length > 1) {
      const roles = [...new Set(matches.map((item) => String(item.role || "")).filter((item) => ["driver", "passenger"].includes(item)))];
      return res.json({
        message: "Multiple accounts found. Select a role to continue.",
        requiresRoleSelection: true,
        roles,
      });
    }

    const user = requestedRole
      ? matches.find((item) => String(item.role) === requestedRole)
      : matches[0];

    if (!user) {
      return res.status(404).json({ message: "No account found for selected role" });
    }

    const now = new Date();
    const resendAllowedAt = user.otpResendAvailableAt ? new Date(user.otpResendAvailableAt) : null;
    if (resendAllowedAt && resendAllowedAt > now) {
      const retryAfterSeconds = Math.ceil((resendAllowedAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds}s before requesting another OTP`,
        retryAfterSeconds,
      });
    }

    const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");

    user.otp = otpHash;
    user.otpExpiry = new Date(Date.now() + FORGOT_OTP_EXPIRY_MINUTES * 60 * 1000);
    user.otpResendAvailableAt = new Date(Date.now() + FORGOT_OTP_RESEND_COOLDOWN_SECONDS * 1000);
    user.resetSessionToken = undefined;
    user.resetSessionExpiry = undefined;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    const shouldSendEmail = Boolean(normalizedEmail);
    const shouldSendSms = Boolean(normalizedPhone);

    const accountEmail = normalizeEmail(user.email || "");
    const accountPhone = String(user.phone || "").trim();

    const emailTarget = shouldSendEmail && accountEmail === normalizedEmail ? user.email : undefined;
    const smsTarget = shouldSendSms && accountPhone === normalizedPhone ? user.phone : undefined;

    if (shouldSendEmail && !emailTarget) {
      return res.status(404).json({ message: "No account found for selected role with this email" });
    }

    if (shouldSendSms && !smsTarget) {
      return res.status(404).json({ message: "No account found for selected role with this phone" });
    }

    const [emailSent, smsSent] = await Promise.all([
      shouldSendEmail ? sendOtpEmail({ to: emailTarget, otp: rawOtp }) : Promise.resolve(false),
      shouldSendSms ? sendOtpSms({ to: smsTarget, otp: rawOtp }) : Promise.resolve(false),
    ]);

    if ((shouldSendEmail && !emailSent) || (shouldSendSms && !smsSent)) {
      return res.status(503).json({
        message: "Could not send OTP right now. Please try again.",
        emailSent,
        smsSent,
      });
    }

    const responsePayload = {
      message: shouldSendEmail && shouldSendSms
        ? "OTP sent to your email and phone"
        : shouldSendEmail
        ? "OTP sent to your email"
        : "OTP sent to your phone",
      role: user.role,
      requiresRoleSelection: false,
      expiresInSeconds: FORGOT_OTP_EXPIRY_MINUTES * 60,
      resendInSeconds: FORGOT_OTP_RESEND_COOLDOWN_SECONDS,
      emailSent,
      smsSent,
    };

    if (process.env.NODE_ENV !== "production") {
      return res.json({
        ...responsePayload,
        otp: rawOtp,
      });
    }

    return res.json(responsePayload);
  } catch (error) {
    return next(error);
  }
};

export const resendForgotPasswordOtp = async (req, res, next) => {
  return forgotPassword(req, res, next);
};

export const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, phone, role, otp } = req.body;

    if ((!email && !phone) || !role || !otp) {
      return res.status(400).json({ message: "email or phone, role and otp are required" });
    }

    const normalizedEmail = email ? normalizeEmail(email) : "";
    const normalizedPhone = phone ? String(phone).trim() : "";
    const requestedRole = String(role || "").trim();

    if (!["driver", "passenger"].includes(requestedRole)) {
      return res.status(400).json({ message: "role must be driver or passenger" });
    }

    const otpHash = crypto.createHash("sha256").update(String(otp)).digest("hex");

    const identifierConditions = [
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ];

    const user = await User.findOne({
      role: requestedRole,
      $or: identifierConditions,
      otp: otpHash,
      otpExpiry: { $gt: new Date() },
    }).select("+otp +otpExpiry +resetSessionToken +resetSessionExpiry +otpResendAvailableAt +resetToken +resetTokenExpiry");

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const rawResetSessionToken = crypto.randomBytes(32).toString("hex");
    const resetSessionTokenHash = crypto.createHash("sha256").update(rawResetSessionToken).digest("hex");

    user.resetSessionToken = resetSessionTokenHash;
    user.resetSessionExpiry = new Date(Date.now() + FORGOT_OTP_VERIFIED_SESSION_MINUTES * 60 * 1000);
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpResendAvailableAt = undefined;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.json({
      message: "OTP verified",
      role: user.role,
      resetSessionToken: rawResetSessionToken,
      resetSessionExpiresInSeconds: FORGOT_OTP_VERIFIED_SESSION_MINUTES * 60,
    });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, phone, role, resetSessionToken, newPassword } = req.body;

    if ((!email && !phone) || !role || !resetSessionToken || !newPassword) {
      return res.status(400).json({ message: "email or phone, role, resetSessionToken and newPassword are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    const normalizedEmail = email ? normalizeEmail(email) : "";
    const normalizedPhone = phone ? String(phone).trim() : "";
    const requestedRole = String(role || "").trim();

    if (!["driver", "passenger"].includes(requestedRole)) {
      return res.status(400).json({ message: "role must be driver or passenger" });
    }

    const identifierConditions = [
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ];

    const resetSessionTokenHash = crypto
      .createHash("sha256")
      .update(String(resetSessionToken))
      .digest("hex");

    const user = await User.findOne({
      role: requestedRole,
      $or: identifierConditions,
      resetSessionToken: resetSessionTokenHash,
      resetSessionExpiry: { $gt: new Date() },
    }).select("+password +resetSessionToken +resetSessionExpiry +otp +otpExpiry +otpResendAvailableAt +resetToken +resetTokenExpiry");

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset session" });
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    user.resetSessionToken = undefined;
    user.resetSessionExpiry = undefined;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpResendAvailableAt = undefined;
    await user.save();

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    return next(error);
  }
};
