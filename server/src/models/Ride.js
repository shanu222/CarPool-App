import mongoose from "mongoose";

const rideSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    pricePerSeat: {
      type: Number,
      required: true,
      min: 1,
    },
    totalSeats: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 0,
    },
    fromCoordinates: {
      lat: Number,
      lng: Number,
    },
    toCoordinates: {
      lat: Number,
      lng: Number,
    },
    distanceText: {
      type: String,
      trim: true,
    },
    durationText: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

rideSchema.index({ fromCity: 1, toCity: 1, date: 1 });

export const Ride = mongoose.model("Ride", rideSchema);
