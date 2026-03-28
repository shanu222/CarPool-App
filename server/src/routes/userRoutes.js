import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { submitVerification } from "../controllers/verificationController.js";
import { deleteOwnAccount } from "../controllers/authController.js";
import { upload } from "../middleware/upload.js";
import { User } from "../models/User.js";
import { UserLocation } from "../models/UserLocation.js";
import { isWithinPakistanBounds } from "../utils/pakistanLocation.js";
import { UserReport } from "../models/UserReport.js";

const router = Router();

router.post("/delete-account", protect, deleteOwnAccount);

const maskPhone = (value) => {
  const phone = String(value || "").trim();
  if (!phone) {
    return "";
  }

  if (phone.length <= 7) {
    return `${phone.slice(0, 2)}****`;
  }

  return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
};

router.post("/location", protect, async (req, res, next) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid lat and lng are required" });
    }

    if (!isWithinPakistanBounds({ lat, lng })) {
      return res.status(400).json({ message: "Only Pakistani cities allowed" });
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

router.post("/block", protect, async (req, res, next) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "targetUserId is required" });
    }

    if (String(targetUserId) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: targetUserId },
    });

    return res.json({ message: "User blocked" });
  } catch (error) {
    return next(error);
  }
});

router.get("/blocked", protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate("blockedUsers", "name role profilePhoto isVerified");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const blocked = (user.blockedUsers || []).map((item) => ({
      _id: item._id,
      name: item.name,
      role: item.role,
      profilePhoto: item.profilePhoto,
      isVerified: Boolean(item.isVerified),
    }));

    return res.json(blocked);
  } catch (error) {
    return next(error);
  }
});

router.delete("/block/:targetUserId", protect, async (req, res, next) => {
  try {
    const targetUserId = req.params.targetUserId;
    if (!targetUserId) {
      return res.status(400).json({ message: "targetUserId is required" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: targetUserId },
    });

    return res.json({ message: "User unblocked" });
  } catch (error) {
    return next(error);
  }
});

router.post("/report", protect, async (req, res, next) => {
  try {
    const { targetUserId, rideId, reason } = req.body;

    if (!targetUserId || !reason?.trim()) {
      return res.status(400).json({ message: "targetUserId and reason are required" });
    }

    const report = await UserReport.create({
      reporterId: req.user._id,
      targetUserId,
      rideId: rideId || undefined,
      reason: reason.trim(),
    });

    return res.status(201).json(report);
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/profile",
  protect,
  upload.fields([{ name: "profilePhoto", maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const nextName = String(req.body?.name || "").trim();
      const nextPhone = String(req.body?.phone || "").trim();
      const profileFile = req.files?.profilePhoto?.[0];

      if (nextName) {
        user.name = nextName;
      }

      if (nextPhone && nextPhone !== user.phone) {
        const duplicate = await User.findOne({
          _id: { $ne: user._id },
          role: user.role,
          phone: nextPhone,
        });

        if (duplicate) {
          return res.status(409).json({ message: "Phone already in use for this role" });
        }

        user.phone = nextPhone;
      }

      if (profileFile) {
        user.profilePhoto = `${req.protocol}://${req.get("host")}/uploads/${profileFile.filename}`;
      }

      await user.save();

      return res.json({
        id: user._id,
        _id: user._id,
        name: user.name,
        phone: user.phone,
        maskedPhone: maskPhone(user.phone),
        role: user.role,
        rating: user.rating,
        isVerified: Boolean(user.isVerified),
        isFeatured: Boolean(user.isFeatured),
        verificationStatus: user.verificationStatus,
        profilePhoto: user.profilePhoto,
        carMake: user.carMake,
        carModel: user.carModel,
        carColor: user.carColor,
        carPlateNumber: user.carPlateNumber,
        carYear: user.carYear,
        cnicNumber: user.cnicNumber || user.cnic,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/:id", protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name phone profilePhoto isVerified paymentApproved canPostRide canBookRide canChat blockedUsers"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      _id: user._id,
      name: user.name,
      maskedPhone: maskPhone(user.phone),
      profilePhoto: user.profilePhoto,
      isVerified: Boolean(user.isVerified),
      isFeatured: String(user._id) === String(req.user._id) ? Boolean(user.isFeatured) : false,
      paymentApproved: Boolean(user.paymentApproved),
      canPostRide: Boolean(user.canPostRide),
      canBookRide: Boolean(user.canBookRide),
      canChat: Boolean(user.canChat),
      blockedUsers: user.blockedUsers || [],
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
