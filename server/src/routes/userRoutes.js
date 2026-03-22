import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { submitVerification } from "../controllers/verificationController.js";
import { upload } from "../middleware/upload.js";
import { User } from "../models/User.js";
import { UserLocation } from "../models/UserLocation.js";

const router = Router();

router.post("/location", protect, async (req, res, next) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid lat and lng are required" });
    }

    const location = await UserLocation.findOneAndUpdate(
      { userId: req.user._id },
      { lat, lng },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json(location);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("name profilePhoto isVerified paymentApproved canPostRide canBookRide canChat");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      _id: user._id,
      name: user.name,
      profilePhoto: user.profilePhoto,
      isVerified: Boolean(user.isVerified),
      paymentApproved: Boolean(user.paymentApproved),
      canPostRide: Boolean(user.canPostRide),
      canBookRide: Boolean(user.canBookRide),
      canChat: Boolean(user.canChat),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/role", protect, async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role || !["passenger", "driver"].includes(role)) {
      return res.status(400).json({ message: "role must be passenger or driver" });
    }

    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Admin role cannot be switched" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = role;
    await user.save();

    return res.json({
      message: `Switched to ${role}`,
      user: {
        id: user._id,
        _id: user._id,
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
        paymentApproved: user.paymentApproved,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/upload-documents",
  protect,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "cnicPhoto", maxCount: 1 },
    { name: "licensePhoto", maxCount: 1 },
    { name: "carPhoto", maxCount: 1 },
  ]),
  submitVerification
);

export default router;
