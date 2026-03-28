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
      enum: ["interaction_unlock", "ride_post", "booking_unlock", "token_purchase"],
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
    tokensRequested: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: "PKR",
      trim: true,
    },
    method: {
      type: String,
      enum: ["easypaisa", "jazzcash", "bank"],
      required: false,
    },
    screenshot: {
      type: String,
      trim: true,
    },
    proofImage: {
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
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

paymentSchema.pre("save", function syncProofFields(next) {
  if (this.proofImage && !this.screenshot) {
    this.screenshot = this.proofImage;
  }

  if (this.screenshot && !this.proofImage) {
    this.proofImage = this.screenshot;
  }

  if (!this.tokensRequested || this.tokensRequested < 0) {
    this.tokensRequested = Math.max(0, Math.floor(Number(this.amount || 0) * 2));
  }

  return next();
});

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ userId: 1, rideId: 1, type: 1, status: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);
