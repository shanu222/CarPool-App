import { Booking } from "../models/Booking.js";
import { ChangeRequest } from "../models/ChangeRequest.js";
import { DeletedUser } from "../models/DeletedUser.js";
import { DeletedUserArchive } from "../models/DeletedUserArchive.js";
import { Location } from "../models/Location.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";
import { Payment } from "../models/Payment.js";
import { Review } from "../models/Review.js";
import { Ride } from "../models/Ride.js";
import { RideRequest } from "../models/RideRequest.js";
import { SupportRequest } from "../models/SupportRequest.js";
import { User } from "../models/User.js";
import { UserLocation } from "../models/UserLocation.js";
import { UserReport } from "../models/UserReport.js";

const toNonEmptyString = (value) => String(value || "").trim();

export const permanentlyDeleteUserAccount = async ({ user, deletedBy, deleteReason, adminUserId }) => {
  if (!user?._id) {
    return;
  }

  const reason = toNonEmptyString(deleteReason);
  const deletedByType = deletedBy === "admin" ? "admin" : "user";

  if (!reason) {
    const error = new Error("Delete reason is required");
    error.statusCode = 400;
    throw error;
  }

  const userId = user._id;
  const mobileNumber = toNonEmptyString(user.phone);
  const cnic = toNonEmptyString(user.cnicNumber || user.cnic);

  const rideIds = await Ride.find({ driver: userId }).distinct("_id");
  const rideRefFilter = rideIds.length
    ? [{ rideId: { $in: rideIds } }, { ride: { $in: rideIds } }, { matchedRideId: { $in: rideIds } }]
    : [];

  await DeletedUser.create({
    userId,
    mobileNumber,
    cnic,
    deletedBy: deletedByType,
    deleteReason: reason,
    deletedAt: new Date(),
  });

  await DeletedUserArchive.create({
    originalUserId: userId,
    name: toNonEmptyString(user.name) || "Deleted User",
    cnic,
    role: user.role,
    banReason: reason,
    deletedBy: adminUserId || userId,
    snapshot: user.toObject ? user.toObject() : user,
  });

  await Promise.all([
    Ride.deleteMany({ driver: userId }),
    Booking.deleteMany({
      $or: [{ passengerId: userId }, { user: userId }, { userId }, { driver: userId }, ...rideRefFilter],
    }),
    RideRequest.deleteMany({
      $or: [{ passengerId: userId }, ...rideRefFilter],
    }),
    Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }, ...rideRefFilter],
    }),
    Notification.deleteMany({ user: userId }),
    Payment.deleteMany({
      $or: [{ userId }, { reviewedBy: userId }, ...rideRefFilter],
    }),
    ChangeRequest.deleteMany({
      $or: [{ userId }, { reviewedBy: userId }],
    }),
    UserReport.deleteMany({
      $or: [{ reporterId: userId }, { targetUserId: userId }],
    }),
    Review.deleteMany({
      $or: [{ reviewerId: userId }, { targetUserId: userId }, ...rideRefFilter],
    }),
    SupportRequest.deleteMany({ userId }),
    UserLocation.deleteMany({ userId }),
    Location.deleteMany({ userId }),
    User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } }),
    User.findByIdAndDelete(userId),
  ]);
};
