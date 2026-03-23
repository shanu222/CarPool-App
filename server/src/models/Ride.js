import mongoose from "mongoose";

const isPakistanLatitude = (value) => value === undefined || (value >= 23.5 && value <= 37.5);
const isPakistanLongitude = (value) => value === undefined || (value >= 60.5 && value <= 77.5);

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
    dateTime: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
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
    bookedSeats: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 0,
    },
    fromCoordinates: {
      lat: {
        type: Number,
        validate: {
          validator: isPakistanLatitude,
          message: "Only Pakistani cities allowed",
        },
      },
      lng: {
        type: Number,
        validate: {
          validator: isPakistanLongitude,
          message: "Only Pakistani cities allowed",
        },
      },
    },
    toCoordinates: {
      lat: {
        type: Number,
        validate: {
          validator: isPakistanLatitude,
          message: "Only Pakistani cities allowed",
        },
      },
      lng: {
        type: Number,
        validate: {
          validator: isPakistanLongitude,
          message: "Only Pakistani cities allowed",
        },
      },
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
      enum: ["live", "nearby", "scheduled", "completed", "cancelled", "ongoing"],
      default: "scheduled",
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    featuredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

rideSchema.index({ fromCity: 1, toCity: 1, date: 1 });

rideSchema.pre("validate", function syncDateTime(next) {
  if ((!this.dateTime || Number.isNaN(new Date(this.dateTime).getTime())) && this.date && this.time) {
    const parsed = new Date(`${this.date}T${this.time}:00`);
    if (!Number.isNaN(parsed.getTime())) {
      this.dateTime = parsed;
    }
  }

  if ((!this.startTime || Number.isNaN(new Date(this.startTime).getTime())) && this.dateTime) {
    this.startTime = this.dateTime;
  }

  if (this.startTime && !this.dateTime) {
    this.dateTime = this.startTime;
  }

  if (this.dateTime && (this.isModified("dateTime") || this.isModified("date") || this.isModified("time"))) {
    const iso = new Date(this.dateTime).toISOString();
    this.date = iso.slice(0, 10);
    this.time = iso.slice(11, 16);
    this.startTime = this.dateTime;
  }

  if (typeof this.totalSeats === "number" && typeof this.bookedSeats !== "number") {
    const available = typeof this.availableSeats === "number" ? this.availableSeats : this.totalSeats;
    this.bookedSeats = Math.max(0, this.totalSeats - available);
  }

  if (typeof this.totalSeats === "number" && typeof this.availableSeats !== "number") {
    this.availableSeats = Math.max(0, this.totalSeats - Number(this.bookedSeats || 0));
  }

  if (typeof this.totalSeats === "number" && typeof this.bookedSeats === "number" && typeof this.availableSeats === "number") {
    const normalizedBooked = Math.min(this.totalSeats, Math.max(0, this.bookedSeats));
    this.bookedSeats = normalizedBooked;
    this.availableSeats = Math.max(0, this.totalSeats - normalizedBooked);
  }

  return next();
});

export const Ride = mongoose.model("Ride", rideSchema);
