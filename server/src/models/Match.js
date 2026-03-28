import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RideRequest",
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
      index: true,
    },
    driverApproved: {
      type: Boolean,
      default: false,
    },
    passengerApproved: {
      type: Boolean,
      default: false,
    },
    // Tracks who has already been charged chat-open tokens for this approved match.
    chatAccessChargedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

matchSchema.index({ rideId: 1, passengerId: 1 }, { unique: true });
matchSchema.index({ driverId: 1, status: 1, createdAt: -1 });
matchSchema.index({ passengerId: 1, status: 1, createdAt: -1 });

export const Match = mongoose.model("Match", matchSchema);
