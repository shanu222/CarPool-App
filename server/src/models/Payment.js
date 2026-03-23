import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["passenger", "driver"],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["interaction_unlock", "ride_post", "booking_unlock"],
      required: true,
      index: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      index: true,
    },
    distanceKm: {
      type: Number,
      min: 0,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "PKR",
      trim: true,
    },
    method: {
      type: String,
      enum: ["easypaisa", "jazzcash", "bank"],
      required: true,
    },
    screenshot: {
      type: String,
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
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ userId: 1, rideId: 1, type: 1, status: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);
