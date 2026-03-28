import mongoose from "mongoose";

const chatAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    unlocked: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

chatAccessSchema.index({ userId: 1, rideId: 1 }, { unique: true });

export const ChatAccess = mongoose.model("ChatAccess", chatAccessSchema);
