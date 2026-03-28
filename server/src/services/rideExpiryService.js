import { Ride } from "../models/Ride.js";
import { RideRequest } from "../models/RideRequest.js";
import { Booking } from "../models/Booking.js";
import { Match } from "../models/Match.js";

export const EXPIRED_RIDE_REASON = "Ride expired. No match found. Please reschedule.";

const RIDE_EXPIRY_CHECK_INTERVAL_MINUTES = Number(process.env.RIDE_EXPIRY_CHECK_INTERVAL_MINUTES || 5);

let scheduler = null;

const hasDateTimePassed = (dateTime, now) => {
  if (!dateTime) {
    return false;
  }

  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed < now;
};

const hasRideMatch = async (rideId) => {
  const [booking, match] = await Promise.all([
    Booking.findOne({
      rideId,
      status: { $in: ["pending", "accepted", "booked", "ongoing", "completed"] },
    })
      .select("_id")
      .lean(),
    Match.findOne({
      rideId,
      status: { $in: ["pending", "approved"] },
    })
      .select("_id")
      .lean(),
  ]);

  return Boolean(booking?._id || match?._id);
};

const hasRequestMatch = async (request) => {
  if (request?.matchedRideId || request?.matchedBookingId) {
    return true;
  }

  const match = await Match.findOne({
    requestId: request._id,
    status: { $in: ["pending", "approved"] },
  })
    .select("_id")
    .lean();

  return Boolean(match?._id);
};

export const checkExpiredRides = async (now = new Date()) => {
  const rideCandidates = await Ride.find({
    status: { $in: ["scheduled", "nearby", "live"] },
  })
    .select("_id dateTime")
    .lean();

  let expiredRideCount = 0;

  for (const ride of rideCandidates) {
    if (!hasDateTimePassed(ride.dateTime, now)) {
      continue;
    }

    const matched = await hasRideMatch(ride._id);

    if (!matched) {
      await Ride.updateOne(
        { _id: ride._id, status: { $in: ["scheduled", "nearby", "live"] } },
        {
          $set: {
            status: "expired",
            expiredReason: EXPIRED_RIDE_REASON,
          },
        }
      );
      expiredRideCount += 1;
    }
  }

  const requestCandidates = await RideRequest.find({
    status: { $in: ["open", "scheduled"] },
  })
    .select("_id dateTime matchedRideId matchedBookingId")
    .lean();

  let expiredRequestCount = 0;

  for (const request of requestCandidates) {
    if (!hasDateTimePassed(request.dateTime, now)) {
      continue;
    }

    const hasMatch = await hasRequestMatch(request);

    if (!hasMatch) {
      await RideRequest.updateOne(
        { _id: request._id, status: { $in: ["open", "scheduled"] } },
        {
          $set: {
            status: "expired",
            expiredReason: EXPIRED_RIDE_REASON,
          },
        }
      );
      expiredRequestCount += 1;
    }
  }

  return {
    expiredRideCount,
    expiredRequestCount,
  };
};

export const startRideExpiryScheduler = () => {
  if (scheduler) {
    return scheduler;
  }

  const intervalMs = Math.max(1, RIDE_EXPIRY_CHECK_INTERVAL_MINUTES) * 60 * 1000;

  scheduler = setInterval(async () => {
    try {
      const result = await checkExpiredRides();
      if (result.expiredRideCount || result.expiredRequestCount) {
        console.log("[RIDE_EXPIRY] Updated expired items", result);
      }
    } catch (error) {
      console.error("[RIDE_EXPIRY] Scheduler failed", error?.message || error);
    }
  }, intervalMs);

  return scheduler;
};
