import mongoose from "mongoose";

const changeRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["cnic_update", "car_update"],
      required: true,
      index: true,
    },
    currentData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requestedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

changeRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const ChangeRequest = mongoose.model("ChangeRequest", changeRequestSchema);
