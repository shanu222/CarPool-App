import { User } from "../models/User.js";

const buildFilePath = (req, file) => {
  if (!file) {
    return undefined;
  }

  return `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
};

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
