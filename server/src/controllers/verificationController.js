import { User } from "../models/User.js";

const buildFilePath = (req, file) => {
  if (!file) {
    return undefined;
  }

  return `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
};

export const submitVerification = async (req, res, next) => {
  try {
    const { cnic } = req.body;

    if (!cnic?.trim()) {
      return res.status(400).json({ message: "cnic is required" });
    }

    const profilePhoto = buildFilePath(req, req.files?.profilePhoto?.[0]);
    const licensePhoto = buildFilePath(req, req.files?.licensePhoto?.[0]);

    req.user.cnic = cnic.trim();
    if (profilePhoto) req.user.profilePhoto = profilePhoto;
    if (licensePhoto) req.user.licensePhoto = licensePhoto;
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
      $or: [{ cnic: { $exists: true, $ne: "" } }, { profilePhoto: { $exists: true, $ne: "" } }, { licensePhoto: { $exists: true, $ne: "" } }],
    })
      .select("name email cnic profilePhoto licensePhoto isVerified role")
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
