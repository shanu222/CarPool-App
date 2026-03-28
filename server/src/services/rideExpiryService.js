import { Ride } from "../models/Ride.js";
import { RideRequest } from "../models/RideRequest.js";
import { Booking } from "../models/Booking.js";

export const EXPIRED_RIDE_REASON = "Ride expired: No match found. Please reschedule again.";

const RIDE_REQUEST_TIMEOUT_MINUTES = Number(process.env.RIDE_REQUEST_TIMEOUT_MINUTES || 60);
const RIDE_POST_TIMEOUT_MINUTES = Number(process.env.RIDE_POST_TIMEOUT_MINUTES || 60);
const RIDE_EXPIRY_CHECK_INTERVAL_MINUTES = Number(process.env.RIDE_EXPIRY_CHECK_INTERVAL_MINUTES || 5);

let scheduler = null;

const isTimeoutReached = (createdAt, timeoutMinutes, now) => {
  if (!createdAt || !Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
    return false;
  }

  const timeoutAt = new Date(createdAt);
  timeoutAt.setMinutes(timeoutAt.getMinutes() + timeoutMinutes);
  return timeoutAt <= now;
};

const shouldExpireByTimeOrTimeout = ({ dateTime, createdAt, timeoutMinutes, now }) => {
  const datePassed = dateTime ? new Date(dateTime) <= now : false;
  const timeoutReached = isTimeoutReached(createdAt, timeoutMinutes, now);
  return datePassed || timeoutReached;
};

const hasRideMatch = async (rideId) => {
  const booking = await Booking.findOne({
    rideId,
    status: { $in: ["pending", "accepted", "booked", "ongoing", "completed"] },
  })
    .select("_id")
    .lean();

  return Boolean(booking?._id);
};

export const checkExpiredRides = async (now = new Date()) => {
  const rideCandidates = await Ride.find({
    status: { $in: ["scheduled", "nearby"] },
  })
    .select("_id dateTime createdAt")
    .lean();

  let expiredRideCount = 0;

  for (const ride of rideCandidates) {
    const shouldCheck = shouldExpireByTimeOrTimeout({
      dateTime: ride.dateTime,
      createdAt: ride.createdAt,
      timeoutMinutes: RIDE_POST_TIMEOUT_MINUTES,
      now,
    });

    if (!shouldCheck) {
      continue;
    }

    const matched = await hasRideMatch(ride._id);

    if (!matched) {
      await Ride.updateOne(
        { _id: ride._id, status: { $in: ["scheduled", "nearby"] } },
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
    .select("_id dateTime createdAt matchedRideId matchedBookingId")
    .lean();

  let expiredRequestCount = 0;

  for (const request of requestCandidates) {
    const shouldCheck = shouldExpireByTimeOrTimeout({
      dateTime: request.dateTime,
      createdAt: request.createdAt,
      timeoutMinutes: RIDE_REQUEST_TIMEOUT_MINUTES,
      now,
    });

    if (!shouldCheck) {
      continue;
    }

    const hasMatch = Boolean(request.matchedRideId || request.matchedBookingId);

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
