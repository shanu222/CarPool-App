import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    seatsRequested: {
      type: Number,
      required: true,
      min: 1,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    seatsBooked: {
      type: Number,
      required: true,
      min: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "ongoing", "completed", "cancelled"],
      default: "pending",
    },
    driverNearNotified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ ride: 1 });
bookingSchema.index({ passengerId: 1, createdAt: -1 });
bookingSchema.index({ rideId: 1, createdAt: -1 });

bookingSchema.pre("validate", function syncBookingAliases(next) {
  if (this.passengerId && !this.user) {
    this.user = this.passengerId;
  }

  if (this.user && !this.passengerId) {
    this.passengerId = this.user;
  }

  if (this.rideId && !this.ride) {
    this.ride = this.rideId;
  }

  if (this.ride && !this.rideId) {
    this.rideId = this.ride;
  }

  if (this.seatsRequested && !this.seatsBooked) {
    this.seatsBooked = this.seatsRequested;
  }

  if (this.seatsBooked && !this.seatsRequested) {
    this.seatsRequested = this.seatsBooked;
  }

  return next();
});

export const Booking = mongoose.model("Booking", bookingSchema);
