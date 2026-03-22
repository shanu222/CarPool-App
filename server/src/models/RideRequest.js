import mongoose from "mongoose";

const rideRequestSchema = new mongoose.Schema(
  {
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fromCity: {
      type: String,
      required: true,
      trim: true,
    },
    toCity: {
      type: String,
      required: true,
      trim: true,
    },
    fromCoordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    toCoordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    dateTime: {
      type: Date,
      required: true,
      index: true,
    },
    seatsNeeded: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    status: {
      type: String,
      enum: ["open", "matched", "completed"],
      default: "open",
      index: true,
    },
    matchedRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
    },
    matchedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
  },
  {
    timestamps: true,
  }
);

rideRequestSchema.index({ status: 1, dateTime: 1 });

export const RideRequest = mongoose.model("RideRequest", rideRequestSchema);
