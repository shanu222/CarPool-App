import mongoose from "mongoose";

const userReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["open", "reviewed"],
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
);

userReportSchema.index({ reporterId: 1, targetUserId: 1, createdAt: -1 });

export const UserReport = mongoose.model("UserReport", userReportSchema);
