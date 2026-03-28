import { User } from "../models/User.js";
import { extractCnicData, extractLicenseData } from "../services/ocrService.js";
import {
  buildVerificationMeta,
  isDateExpired,
  toDateOrNull,
  verifyIdentityDocuments,
} from "../services/verificationFlowService.js";
import { normalizeCnic } from "../utils/kycUtils.js";

const buildFilePath = (req, file) => {
  if (!file) {
    return undefined;
  }

  return `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
};

const toStoredUploadPath = (file) => (file?.path ? file.path : "");

const statusResponse = (user, extra = {}) => ({
  message: extra.message,
  warningMessages: extra.warningMessages || [],
  ...buildVerificationMeta({
    isVerified: user?.isVerified,
    isCnicExpired: user?.isCnicExpired,
    isLicenseExpired: user?.isLicenseExpired,
    role: user?.role,
  }),
  cnicExpiryDate: user?.cnicExpiryDate || null,
  licenseExpiryDate: user?.licenseExpiryDate || null,
});

export const submitVerification = async (req, res, next) => {
  try {
    const cnic = req.body.cnicNumber || req.body.cnic;
    const {
      carMake,
      carModel,
      carColor,
      carPlateNumber,
      carYear,
    } = req.body;

    if (!cnic?.trim()) {
      return res.status(400).json({ message: "cnicNumber is required" });
    }

    const profilePhoto = buildFilePath(req, req.files?.profilePhoto?.[0]);
    const cnicPhoto = buildFilePath(req, req.files?.cnicPhoto?.[0]) || buildFilePath(req, req.files?.licensePhoto?.[0]);
    const carPhoto = buildFilePath(req, req.files?.carPhoto?.[0]);

    if (req.user.role === "driver") {
      if (!profilePhoto && !req.user.profilePhoto) {
        return res.status(400).json({ message: "profile photo is required for driver verification" });
      }

      if (!cnicPhoto && !req.user.cnicPhoto) {
        return res.status(400).json({ message: "cnic photo is required for driver verification" });
      }

      if (!carPhoto && !req.user.carPhoto) {
        return res.status(400).json({ message: "car photo is required for driver verification" });
      }

      if (!carMake?.trim() || !carModel?.trim() || !carPlateNumber?.trim()) {
        return res.status(400).json({ message: "car make, model and plate number are required" });
      }
    }

    req.user.cnic = cnic.trim();
    req.user.cnicNumber = cnic.trim();
    if (profilePhoto) req.user.profilePhoto = profilePhoto;
    if (cnicPhoto) {
      req.user.cnicPhoto = cnicPhoto;
      req.user.licensePhoto = cnicPhoto;
    }
    if (carPhoto) req.user.carPhoto = carPhoto;
    if (carMake) req.user.carMake = String(carMake).trim();
    if (carModel) req.user.carModel = String(carModel).trim();
    if (carColor) req.user.carColor = String(carColor).trim();
    if (carPlateNumber) req.user.carPlateNumber = String(carPlateNumber).trim();
    if (carYear) req.user.carYear = Number(carYear);
    req.user.isVerified = false;
    req.user.verificationStatus = "pending";

    await req.user.save();

    return res.json({ message: "Verification submitted. Waiting for admin approval." });
  } catch (error) {
    return next(error);
  }
};

export const listVerificationRequests = async (_req, res, next) => {
  try {
    const users = await User.find({
      $or: [
        { cnic: { $exists: true, $ne: "" } },
        { cnicNumber: { $exists: true, $ne: "" } },
        { profilePhoto: { $exists: true, $ne: "" } },
        { cnicPhoto: { $exists: true, $ne: "" } },
      ],
    })
      .select("name email cnic cnicNumber profilePhoto cnicPhoto licensePhoto isVerified role")
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (error) {
    return next(error);
  }
};

export const verifyUser = async (req, res, next) => {
  try {
    const { isVerified } = req.body;
    const verified = Boolean(isVerified);

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isVerified: verified, verificationStatus: verified ? "verified" : "rejected" },
      { new: true }
    ).select("name email isVerified verificationStatus role");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
};

export const reverifySelf = async (req, res, next) => {
  try {
    const { cnic, cnicNumber, dob } = req.body;
    const profileImageFile = req.files?.profileImage?.[0];
    const cnicFrontFile = req.files?.cnicFront?.[0];
    const cnicBackFile = req.files?.cnicBack?.[0];

    if (!cnic && !cnicNumber) {
      return res.status(400).json({ message: "cnic is required" });
    }

    if (!dob) {
      return res.status(400).json({ message: "dob is required" });
    }

    if (!profileImageFile || !cnicFrontFile || !cnicBackFile) {
      return res.status(400).json({ message: "profileImage, cnicFront and cnicBack are required" });
    }

    const verifyResult = await verifyIdentityDocuments({
      name: req.user.name,
      dob,
      cnic: cnic || cnicNumber,
      role: req.user.role,
      cnicFrontPath: toStoredUploadPath(cnicFrontFile),
      cnicBackPath: toStoredUploadPath(cnicBackFile),
      profileImagePath: toStoredUploadPath(profileImageFile),
      enforceLicenseCheck: false,
    });

    if (!verifyResult.ok) {
      return res.status(400).json({
        message: "Information does not match CNIC",
        reason: verifyResult.reason,
        details: verifyResult.details,
      });
    }

    req.user.cnic = verifyResult.normalizedCnic;
    req.user.cnicNumber = verifyResult.normalizedCnic;
    req.user.dob = verifyResult.normalizedDob;
    req.user.cnicFrontImage = buildFilePath(req, cnicFrontFile);
    req.user.cnicBackImage = buildFilePath(req, cnicBackFile);
    req.user.profilePhoto = buildFilePath(req, profileImageFile);
    req.user.selfieImage = buildFilePath(req, profileImageFile);
    req.user.isVerified = true;
    req.user.verified = true;
    req.user.verificationStatus = "verified";
    req.user.cnicExpiryDate = verifyResult.cnicExpiryDate;
    req.user.isCnicExpired = verifyResult.isCnicExpired;

    const warningMessages = [];
    if (verifyResult.isCnicExpired) {
      warningMessages.push("Your CNIC is expired. This will be visible to other users.");
    }

    await req.user.save();

    return res.json(
      statusResponse(req.user, {
        message: "Verification completed successfully.",
        warningMessages,
      })
    );
  } catch (error) {
    return next(error);
  }
};

export const renewCnicSelf = async (req, res, next) => {
  try {
    const cnicFrontFile = req.files?.cnicFront?.[0];
    const cnicBackFile = req.files?.cnicBack?.[0];

    if (!cnicFrontFile || !cnicBackFile) {
      return res.status(400).json({ message: "cnicFront and cnicBack are required" });
    }

    const cnicData = await extractCnicData({
      cnicFrontPath: toStoredUploadPath(cnicFrontFile),
      cnicBackPath: toStoredUploadPath(cnicBackFile),
    });

    if (!cnicData?.cnic) {
      return res.status(400).json({ message: "Unable to extract CNIC data" });
    }

    const extractedCnic = normalizeCnic(cnicData.cnic);
    const currentCnic = normalizeCnic(req.user.cnicNumber || req.user.cnic || "");

    if (currentCnic && extractedCnic && currentCnic !== extractedCnic) {
      return res.status(400).json({ message: "Uploaded CNIC does not match your account CNIC" });
    }

    const cnicExpiryDate = toDateOrNull(cnicData.cnicExpiry);
    const isCnicExpired = isDateExpired(cnicExpiryDate);

    req.user.cnicFrontImage = buildFilePath(req, cnicFrontFile);
    req.user.cnicBackImage = buildFilePath(req, cnicBackFile);
    if (extractedCnic) {
      req.user.cnic = extractedCnic;
      req.user.cnicNumber = extractedCnic;
    }
    req.user.cnicExpiryDate = cnicExpiryDate;
    req.user.isCnicExpired = isCnicExpired;

    await req.user.save();

    const warningMessages = [];
    if (isCnicExpired) {
      warningMessages.push("Your CNIC is expired. This will be visible to other users.");
    }

    return res.json(
      statusResponse(req.user, {
        message: isCnicExpired ? "CNIC updated but it is still expired." : "CNIC renewed successfully.",
        warningMessages,
      })
    );
  } catch (error) {
    return next(error);
  }
};

export const renewLicenseSelf = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Only drivers can renew license" });
    }

    const licenseImageFile = req.files?.licenseImage?.[0];

    if (!licenseImageFile) {
      return res.status(400).json({ message: "licenseImage is required" });
    }

    const licenseData = await extractLicenseData(toStoredUploadPath(licenseImageFile));
    const licenseExpiryDate = toDateOrNull(licenseData?.licenseExpiry);
    const isLicenseExpired = isDateExpired(licenseExpiryDate);

    req.user.licensePhoto = buildFilePath(req, licenseImageFile);
    if (req.user.role === "driver") {
      req.user.cnicPhoto = buildFilePath(req, licenseImageFile);
    }
    req.user.licenseExpiryDate = licenseExpiryDate;
    req.user.isLicenseExpired = isLicenseExpired;

    await req.user.save();

    const warningMessages = [];
    if (isLicenseExpired) {
      warningMessages.push("Your license is expired. This will be visible to other users.");
    }

    return res.json(
      statusResponse(req.user, {
        message: isLicenseExpired
          ? "License updated but it is still expired."
          : "License renewed successfully.",
        warningMessages,
      })
    );
  } catch (error) {
    return next(error);
  }
};
