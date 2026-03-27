import { User } from "../models/User.js";
import { Ride } from "../models/Ride.js";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { PaymentSettings } from "../models/PaymentSettings.js";
import { ChangeRequest } from "../models/ChangeRequest.js";
import { UserReport } from "../models/UserReport.js";
import { DeletedUserArchive } from "../models/DeletedUserArchive.js";
import { createUserNotification } from "../services/notificationService.js";

const archiveAndDeleteUser = async ({ user, adminUserId }) => {
  if (!user) {
    return;
  }

  await DeletedUserArchive.create({
    originalUserId: user._id,
    name: user.name,
    cnic: user.cnicNumber || user.cnic || "",
    role: user.role,
    banReason: user.suspensionReason || "",
    deletedBy: adminUserId,
    snapshot: user.toObject ? user.toObject() : user,
  });

  await Promise.all([
    Ride.deleteMany({ driver: user._id }),
    Booking.deleteMany({ $or: [{ user: user._id }, { passengerId: user._id }] }),
    Payment.deleteMany({ userId: user._id }),
    ChangeRequest.deleteMany({ userId: user._id }),
    UserReport.deleteMany({ $or: [{ reporterId: user._id }, { targetUserId: user._id }] }),
    User.findByIdAndDelete(user._id),
  ]);
};

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
        "name email phone role status rating isVerified verificationStatus cnicNumber cnic profilePhoto licensePhoto cnicPhoto carPhoto carMake carModel carColor carPlateNumber carYear accountStatus suspensionReason bannedAt isBlocked tokenBalance freeRideCredits freeChatCredits canPostRide canBookRide canChat paymentApproved createdAt"
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
      user.bannedAt = null;
    }

    if (status === "pending") {
      user.accountStatus = "active";
      user.isBlocked = false;
      user.isVerified = false;
      user.verificationStatus = "rejected";
      user.suspensionReason = (reason || "").trim();
      user.bannedAt = null;
    }

    if (status === "suspended") {
      user.accountStatus = "suspended";
      user.isBlocked = true;
      user.suspensionReason = (reason || "").trim();
      user.bannedAt = null;
      user.canPostRide = false;
      user.canBookRide = false;
      user.canChat = false;
      user.paymentApproved = false;
    }

    if (status === "banned") {
      user.accountStatus = "banned";
      user.isBlocked = true;
      user.suspensionReason = (reason || "").trim();
      user.bannedAt = new Date();
      user.canPostRide = false;
      user.canBookRide = false;
      user.canChat = false;
      user.paymentApproved = false;
    }

    await user.save();
    return res.json({ message: "User status updated", user });
  } catch (error) {
    return next(error);
  }
};

export const deleteUserByAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await archiveAndDeleteUser({ user, adminUserId: req.user._id });

    return res.json({ message: "User deleted" });
  } catch (error) {
    return next(error);
  }
};

export const unbanUserByAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = "approved";
    user.accountStatus = "active";
    user.isBlocked = false;
    user.suspensionReason = "";
    user.bannedAt = null;
    user.canPostRide = true;
    user.canBookRide = true;
    user.canChat = true;

    await user.save();

    return res.json({ message: "User unbanned", user });
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

export const getAdminBookings = async (_req, res, next) => {
  try {
    const bookings = await Booking.find({})
      .populate("passengerId", "name email phone role")
      .populate("rideId", "fromCity toCity date time status driver")
      .sort({ createdAt: -1 });

    return res.json(bookings);
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
      .populate("rideId", "fromCity toCity status")
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
        const paidAmount = Number(payment.amount || 0);
        const creditedTokens = Math.max(1, Math.floor(paidAmount / 50));

        user.tokenBalance = Number(user.tokenBalance || 0) + creditedTokens;
        user.paymentApproved = true;
        user.canChat = true;

        await user.save();

        await createUserNotification({
          userId: user._id,
          type: "payment_update",
          title: "Payment approved",
          body: `Your payment has been approved and ${creditedTokens} tokens were added.`,
          data: { paymentId: payment._id, paymentType: payment.type, creditedTokens },
          pushFallback: true,
        });
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

export const getDeletedUsersByAdmin = async (_req, res, next) => {
  try {
    const archivedUsers = await DeletedUserArchive.find({})
      .populate("deletedBy", "name role")
      .sort({ createdAt: -1 });

    return res.json(archivedUsers);
  } catch (error) {
    return next(error);
  }
};

export const getAdminChangeRequests = async (_req, res, next) => {
  try {
    const requests = await ChangeRequest.find({})
      .populate("userId", "name role isVerified")
      .populate("reviewedBy", "name role")
      .sort({ createdAt: -1 });

    return res.json(requests);
  } catch (error) {
    return next(error);
  }
};

export const reviewAdminChangeRequest = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be approved or rejected" });
    }

    const request = await ChangeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Change request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be reviewed" });
    }

    if (status === "approved") {
      const user = await User.findById(request.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (request.type === "cnic_update") {
        const nextCnic = String(request.requestedData?.cnicNumber || "").trim();
        if (nextCnic) {
          user.cnic = nextCnic;
          user.cnicNumber = nextCnic;
        }
      }

      if (request.type === "car_update") {
        user.carMake = String(request.requestedData?.carMake || "").trim();
        user.carModel = String(request.requestedData?.carModel || "").trim();
        user.carColor = String(request.requestedData?.carColor || "").trim();
        user.carPlateNumber = String(request.requestedData?.carPlateNumber || "").trim();
        if (request.requestedData?.carYear) {
          user.carYear = Number(request.requestedData.carYear);
        }
      }

      await user.save();
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    const populated = await ChangeRequest.findById(request._id)
      .populate("userId", "name role isVerified")
      .populate("reviewedBy", "name role");

    return res.json(populated);
  } catch (error) {
    return next(error);
  }
};

export const getAdminReports = async (_req, res, next) => {
  try {
    const reports = await UserReport.find({})
      .populate("reporterId", "name role")
      .populate("targetUserId", "name role status accountStatus")
      .populate("rideId", "fromCity toCity date time")
      .sort({ createdAt: -1 });

    return res.json(reports);
  } catch (error) {
    return next(error);
  }
};

export const reviewUserReportByAdmin = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { action } = req.body;

    if (!reportId || !["ignore", "ban", "delete"].includes(action)) {
      return res.status(400).json({ message: "reportId and valid action (ignore/ban/delete) are required" });
    }

    const report = await UserReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const targetUser = await User.findById(report.targetUserId);

    if (action === "ban" && targetUser) {
      targetUser.status = "banned";
      targetUser.accountStatus = "banned";
      targetUser.isBlocked = true;
      targetUser.suspensionReason = report.reason || "Reported by users";
      targetUser.bannedAt = new Date();
      targetUser.canPostRide = false;
      targetUser.canBookRide = false;
      targetUser.canChat = false;
      targetUser.paymentApproved = false;
      await targetUser.save();
    }

    if (action === "delete" && targetUser) {
      await archiveAndDeleteUser({ user: targetUser, adminUserId: req.user._id });
    }

    if (action !== "delete") {
      report.status = "reviewed";
      await report.save();
    }

    return res.json({ message: `Report action '${action}' applied` });
  } catch (error) {
    return next(error);
  }
};
