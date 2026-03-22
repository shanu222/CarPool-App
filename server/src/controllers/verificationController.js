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

    if (!cnic?.trim()) {
      return res.status(400).json({ message: "cnicNumber is required" });
    }

    const profilePhoto = buildFilePath(req, req.files?.profilePhoto?.[0]);
    const cnicPhoto = buildFilePath(req, req.files?.cnicPhoto?.[0]) || buildFilePath(req, req.files?.licensePhoto?.[0]);

    req.user.cnic = cnic.trim();
    req.user.cnicNumber = cnic.trim();
    if (profilePhoto) req.user.profilePhoto = profilePhoto;
    if (cnicPhoto) {
      req.user.cnicPhoto = cnicPhoto;
      req.user.licensePhoto = cnicPhoto;
    }
    req.user.isVerified = false;

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

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isVerified: Boolean(isVerified) },
      { new: true }
    ).select("name email isVerified role");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
};
