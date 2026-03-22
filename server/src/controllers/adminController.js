import { User } from "../models/User.js";
import { Ride } from "../models/Ride.js";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { PaymentSettings } from "../models/PaymentSettings.js";

const getOrCreatePaymentSettings = async () => {
  let settings = await PaymentSettings.findOne().sort({ updatedAt: -1 });

  if (!settings) {
    settings = await PaymentSettings.create({});
  }

  return settings;
};

export const getAdminUsers = async (req, res, next) => {
  try {
    const { role, status } = req.query;

    const query = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    };

    const users = await User.find(query)
      .select(
        "name email phone role status rating isVerified verificationStatus cnicNumber cnic profilePhoto licensePhoto cnicPhoto carPhoto carMake carModel carColor carPlateNumber carYear accountStatus suspensionReason isBlocked canPostRide canBookRide canChat createdAt"
      )
      .sort({ createdAt: -1 });

    const normalized = users.map((userDoc) => {
      const user = userDoc.toObject();

      if (!user.status) {
        if (user.accountStatus === "banned") {
          user.status = "banned";
        } else if (user.accountStatus === "suspended") {
          user.status = "suspended";
        } else if (user.verificationStatus === "approved") {
          user.status = "approved";
        } else {
          user.status = "pending";
        }
      }

      return user;
    });

    return res.json(normalized);
  } catch (error) {
    return next(error);
  }
};

export const verifyUserByAdmin = async (req, res, next) => {
  try {
    const { userId, action } = req.body;

    if (!userId || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "userId and action (approve/reject) are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isVerified = action === "approve";
    user.verificationStatus = action === "approve" ? "approved" : "rejected";
    user.status = action === "approve" ? "approved" : "pending";
    user.accountStatus = action === "approve" ? "active" : "active";
    user.isBlocked = false;

    if (action === "approve") {
      user.suspensionReason = "";
    }

    await user.save();

    return res.json({
      message: action === "approve" ? "User verified" : "User verification rejected",
      user,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateUserStatusByAdmin = async (req, res, next) => {
  try {
    const { userId, status, reason } = req.body;

    if (!userId || !["pending", "approved", "suspended", "banned"].includes(status)) {
      return res.status(400).json({ message: "userId and valid status are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = status;

    if (status === "approved") {
      user.accountStatus = "active";
      user.isBlocked = false;
      user.isVerified = true;
      user.verificationStatus = "approved";
      user.suspensionReason = "";
    }

    if (status === "pending") {
      user.accountStatus = "active";
      user.isBlocked = false;
      user.isVerified = false;
      user.verificationStatus = "rejected";
      user.suspensionReason = (reason || "").trim();
    }

    if (status === "suspended") {
      user.accountStatus = "suspended";
      user.isBlocked = true;
      user.suspensionReason = (reason || "").trim();
      user.canPostRide = false;
      user.canBookRide = false;
      user.canChat = false;
    }

    if (status === "banned") {
      user.accountStatus = "banned";
      user.isBlocked = true;
      user.suspensionReason = (reason || "").trim();
      user.canPostRide = false;
      user.canBookRide = false;
      user.canChat = false;
    }

    await user.save();
    return res.json({ message: "User status updated", user });
  } catch (error) {
    return next(error);
  }
};

export const getAdminRides = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = {
      ...(status ? { status } : {}),
    };

    const rides = await Ride.find(query)
      .populate("driver", "name email phone role isVerified accountStatus")
      .sort({ createdAt: -1 });

    return res.json(rides);
  } catch (error) {
    return next(error);
  }
};

export const deleteRideByAdmin = async (req, res, next) => {
  try {
    const ride = await Ride.findByIdAndDelete(req.params.rideId);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    await Booking.deleteMany({ $or: [{ rideId: ride._id }, { ride: ride._id }] });

    return res.json({ message: "Ride deleted" });
  } catch (error) {
    return next(error);
  }
};

export const featureRideByAdmin = async (req, res, next) => {
  try {
    const { rideId, featured = true } = req.body;

    if (!rideId) {
      return res.status(400).json({ message: "rideId is required" });
    }

    const ride = await Ride.findByIdAndUpdate(
      rideId,
      {
        featured: Boolean(featured),
        featuredAt: featured ? new Date() : null,
      },
      { new: true }
    ).populate("driver", "name email role");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    return res.json(ride);
  } catch (error) {
    return next(error);
  }
};

export const getAdminPayments = async (_req, res, next) => {
  try {
    const payments = await Payment.find({})
      .populate("userId", "name email phone role accountStatus")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json(payments);
  } catch (error) {
    return next(error);
  }
};

export const approvePaymentByAdmin = async (req, res, next) => {
  try {
    const { paymentId, status, rejectionReason } = req.body;

    if (!paymentId || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "paymentId and valid status are required" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = status;
    payment.reviewedBy = req.user._id;
    payment.rejectionReason = status === "rejected" ? (rejectionReason || "").trim() : "";
    await payment.save();

    if (status === "approved") {
      const user = await User.findById(payment.userId);
      if (user) {
        if (payment.type === "ride_post") {
          user.canPostRide = true;
        }

        if (payment.type === "booking" || payment.type === "subscription") {
          user.canBookRide = true;
          user.canChat = true;
        }

        await user.save();
      }
    }

    const populated = await Payment.findById(payment._id)
      .populate("userId", "name email phone role")
      .populate("reviewedBy", "name email");

    return res.json(populated);
  } catch (error) {
    return next(error);
  }
};

export const getPaymentSettingsAdmin = async (_req, res, next) => {
  try {
    const settings = await getOrCreatePaymentSettings();
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
};

export const updatePaymentSettingsAdmin = async (req, res, next) => {
  try {
    const { easypaisaNumber, jazzcashNumber, bankAccount, accountTitle } = req.body;

    const settings = await getOrCreatePaymentSettings();
    settings.easypaisaNumber = easypaisaNumber ?? settings.easypaisaNumber;
    settings.jazzcashNumber = jazzcashNumber ?? settings.jazzcashNumber;
    settings.bankAccount = bankAccount ?? settings.bankAccount;
    settings.accountTitle = accountTitle ?? settings.accountTitle;
    settings.updatedBy = req.user._id;
    await settings.save();

    return res.json(settings);
  } catch (error) {
    return next(error);
  }
};

export const getAdminAnalytics = async (_req, res, next) => {
  try {
    const [totalUsers, totalRides, activeRidesAgg, earningsAgg] = await Promise.all([
      User.countDocuments({}),
      Ride.countDocuments({}),
      Ride.countDocuments({ status: { $in: ["scheduled", "ongoing"] } }),
      Payment.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalEarnings = earningsAgg?.[0]?.total || 0;

    return res.json({
      totalUsers,
      totalRides,
      totalEarnings,
      activeRides: activeRidesAgg,
    });
  } catch (error) {
    return next(error);
  }
};
