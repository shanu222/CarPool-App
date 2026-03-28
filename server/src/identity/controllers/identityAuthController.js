import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  clearVerificationAttempts,
  consumeVerificationAttempt,
  createVerifiedUser,
  ensureIdentitySchema,
  findExistingAccountForRole,
  getUserByIdentity,
  getUserByPhoneAndRole,
  saveResetToken,
  updatePasswordWithResetToken,
} from "../repository/identityAuthRepository.js";
import { compareFaceAgainstCnic } from "../services/faceMatchService.js";
import { extractLicenseDataFromImage } from "../services/licenseOcrService.js";
import { extractCnicDataFromImages } from "../services/ocrService.js";
import { saveVerificationFile } from "../services/storageService.js";
import {
  isSameDate,
  isValidCnic,
  normalizeCnic,
  normalizeDob,
  normalizeLicenseNumber,
  normalizeName,
  normalizePhone,
} from "../utils/cnicUtils.js";

const VERIFICATION_MAX_ATTEMPTS = Number(process.env.IDENTITY_VERIFICATION_MAX_ATTEMPTS || 5);
const VERIFICATION_BLOCK_MINUTES = Number(process.env.IDENTITY_VERIFICATION_BLOCK_MINUTES || 15);
const RESET_TOKEN_EXPIRY_MINUTES = Number(process.env.IDENTITY_RESET_TOKEN_EXPIRY_MINUTES || 10);

let schemaInitialized = false;

const initializeSchema = async () => {
  if (schemaInitialized) {
    return;
  }

  await ensureIdentitySchema();
  schemaInitialized = true;
};

const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      scope: "identity-auth",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const passwordRulesMet = (password) => {
  const value = String(password || "");

  return (
    value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)
  );
};

const parseRole = (value) => String(value || "").trim().toLowerCase();

const requiredFile = (files, key) => files?.[key]?.[0] || null;

const sendError = (res, status, message) => res.status(status).json({ message });

const duplicateRoleMessage = (role) => `Account already exists as ${role}. Please login.`;

export const signupWithIdentityVerification = async (req, res, next) => {
  let role = "";

  try {
    await initializeSchema();

    role = parseRole(req.body.role);

    if (!["passenger", "driver"].includes(role)) {
      return sendError(res, 400, "role must be passenger or driver");
    }

    const name = String(req.body.name || "").trim();
    const phone = normalizePhone(req.body.phone || req.body.mobile);
    const cnic = normalizeCnic(req.body.cnic);
    const dob = normalizeDob(req.body.dob);
    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");
    const licenseNumber = String(req.body.licenseNumber || "").trim();

    const profileImageFile = requiredFile(req.files, "profileImage");
    const cnicFrontFile = requiredFile(req.files, "cnicFront");
    const cnicBackFile = requiredFile(req.files, "cnicBack");
    const licenseImageFile = requiredFile(req.files, "licenseImage");

    if (!name || !phone || !cnic || !dob || !password || !confirmPassword) {
      return sendError(res, 400, "Missing required fields");
    }

    if (!isValidCnic(cnic)) {
      return sendError(res, 400, "Invalid CNIC format");
    }

    if (password !== confirmPassword) {
      return sendError(res, 400, "Passwords do not match");
    }

    if (!passwordRulesMet(password)) {
      return sendError(res, 400, "Password too weak");
    }

    if (!profileImageFile || !cnicFrontFile || !cnicBackFile) {
      return sendError(res, 400, "Missing required verification images");
    }

    if (role === "driver" && (!licenseNumber || !licenseImageFile)) {
      return sendError(res, 400, "Driving license details are required for drivers");
    }

    const duplicateExists = await findExistingAccountForRole({
      cnic,
      phone,
      role,
    });

    if (duplicateExists) {
      return sendError(res, 409, duplicateRoleMessage(role));
    }

    const attemptIdentifier = `${role}:${phone}:${cnic}`;
    const attemptStatus = await consumeVerificationAttempt({
      identifier: attemptIdentifier,
      maxAttempts: VERIFICATION_MAX_ATTEMPTS,
      blockMinutes: VERIFICATION_BLOCK_MINUTES,
    });

    if (attemptStatus.blocked) {
      return sendError(res, 429, "Too many verification attempts. Try again later.");
    }

    let parsedCnic;

    try {
      parsedCnic = await extractCnicDataFromImages({
        frontBuffer: cnicFrontFile.buffer,
        backBuffer: cnicBackFile.buffer,
      });
    } catch (error) {
      if (error?.statusCode === 400) {
        return sendError(res, 400, "Uploaded CNIC image is unclear");
      }

      throw error;
    }

    if (normalizeCnic(parsedCnic.cnic) !== cnic) {
      return sendError(res, 400, "CNIC number does not match the uploaded CNIC");
    }

    if (normalizeName(parsedCnic.name) !== normalizeName(name)) {
      return sendError(res, 400, "Name does not match CNIC");
    }

    if (!isSameDate(parsedCnic.dob, dob)) {
      return sendError(res, 400, "Date of birth does not match CNIC");
    }

    if (role === "driver") {
      let parsedLicense;

      try {
        parsedLicense = await extractLicenseDataFromImage({
          licenseBuffer: licenseImageFile.buffer,
        });
      } catch (error) {
        if (error?.statusCode === 400) {
          return sendError(res, 400, "Uploaded driving license image is unclear");
        }

        throw error;
      }

      if (normalizeLicenseNumber(parsedLicense.licenseNumber) !== normalizeLicenseNumber(licenseNumber)) {
        return sendError(res, 400, "License number does not match the uploaded driving license");
      }
    }

    let faceResult;

    try {
      faceResult = await compareFaceAgainstCnic({
        profileBuffer: profileImageFile.buffer,
        cnicFrontBuffer: cnicFrontFile.buffer,
        threshold: 80,
      });
    } catch (error) {
      if (error?.statusCode === 400) {
        return sendError(res, 400, "Uploaded CNIC image is unclear");
      }

      throw error;
    }

    if (!faceResult.matched) {
      return sendError(res, 400, "Face does not match CNIC photo");
    }

    const [profileImagePath, cnicFrontPath, cnicBackPath, licenseImagePath] = await Promise.all([
      saveVerificationFile({ file: profileImageFile }),
      saveVerificationFile({ file: cnicFrontFile }),
      saveVerificationFile({ file: cnicBackFile }),
      role === "driver" ? saveVerificationFile({ file: licenseImageFile }) : Promise.resolve(null),
    ]);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await createVerifiedUser({
      name,
      phone,
      cnic,
      dob,
      passwordHash,
      role,
      profileImage: profileImagePath,
      cnicFront: cnicFrontPath,
      cnicBack: cnicBackPath,
      licenseNumber,
      licenseImage: licenseImagePath,
    });

    await clearVerificationAttempts(attemptIdentifier);

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        is_verified: user.is_verified,
      },
    });
  } catch (error) {
    if (error?.statusCode) {
      return sendError(res, error.statusCode, error.message);
    }

    if (error?.code === "23505") {
      return sendError(res, 409, duplicateRoleMessage(role || "selected role"));
    }

    return next(error);
  }
};

export const loginIdentityUser = async (req, res, next) => {
  try {
    await initializeSchema();

    const role = parseRole(req.body.role);
    const phone = normalizePhone(req.body.phone || req.body.mobile);
    const password = String(req.body.password || "");

    if (!phone || !password || !["passenger", "driver"].includes(role)) {
      return sendError(res, 400, "phone, password and role are required");
    }

    const user = await getUserByPhoneAndRole(phone, role);

    if (!user) {
      return sendError(res, 401, "Invalid credentials");
    }

    if (!user.is_verified) {
      return sendError(res, 403, "User is not verified");
    }

    if (user.is_banned) {
      return sendError(res, 403, "Account is banned");
    }

    if (user.is_deleted) {
      return sendError(res, 403, "Account is deleted");
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return sendError(res, 401, "Invalid credentials");
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        is_verified: user.is_verified,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyForgotPasswordIdentity = async (req, res, next) => {
  try {
    await initializeSchema();

    const role = parseRole(req.body.role);
    const phone = normalizePhone(req.body.phone || req.body.mobile);
    const cnic = normalizeCnic(req.body.cnic);
    const dob = normalizeDob(req.body.dob);

    if (!phone || !cnic || !dob || !["passenger", "driver"].includes(role)) {
      return sendError(res, 400, "phone, cnic, dob and role are required");
    }

    const user = await getUserByIdentity({ phone, cnic, dob, role });

    if (!user) {
      return sendError(res, 404, "No account found with provided details");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    await saveResetToken({
      userId: user.id,
      token: resetToken,
      expiryMinutes: RESET_TOKEN_EXPIRY_MINUTES,
    });

    return res.json({
      message: "Identity confirmed. You can now reset your password.",
      resetToken,
      expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
    });
  } catch (error) {
    return next(error);
  }
};

export const resetIdentityPassword = async (req, res, next) => {
  try {
    await initializeSchema();

    const role = parseRole(req.body.role);
    const phone = normalizePhone(req.body.phone || req.body.mobile);
    const resetToken = String(req.body.resetToken || "").trim();
    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!phone || !resetToken || !password || !confirmPassword || !["passenger", "driver"].includes(role)) {
      return sendError(res, 400, "phone, role, resetToken, password and confirmPassword are required");
    }

    if (password !== confirmPassword) {
      return sendError(res, 400, "Passwords do not match");
    }

    if (!passwordRulesMet(password)) {
      return sendError(res, 400, "Password too weak");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await updatePasswordWithResetToken({
      phone,
      role,
      token: resetToken,
      passwordHash,
    });

    if (!updated) {
      return sendError(res, 400, "Invalid or expired reset token");
    }

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    return next(error);
  }
};
