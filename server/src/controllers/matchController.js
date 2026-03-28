import { Booking } from "../models/Booking.js";
import { Match } from "../models/Match.js";
import { Ride } from "../models/Ride.js";
import { RideRequest } from "../models/RideRequest.js";
import { createUserNotification } from "../services/notificationService.js";
import { getIo } from "../socket/io.js";

const MATCH_TIME_WINDOW_MINUTES = Number(process.env.MATCH_TIME_WINDOW_MINUTES || 90);

const normalizeCity = (value) => String(value || "").trim().toLowerCase();

const isRouteMatch = (ride, request) => {
  return normalizeCity(ride?.fromCity) === normalizeCity(request?.fromCity) && normalizeCity(ride?.toCity) === normalizeCity(request?.toCity);
};

const isDateTimeMatch = (left, right) => {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return false;
  }

  const diffMinutes = Math.abs(leftTime - rightTime) / (1000 * 60);
  return diffMinutes <= MATCH_TIME_WINDOW_MINUTES;
};

const getRideDateParts = (rideDateTime) => {
  const iso = new Date(rideDateTime).toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
  };
};

const buildMatchResponse = ({ match, ride, request, booking, meId }) => {
  const isDriver = String(match.driverId?._id || match.driverId) === String(meId);
  const otherUser = isDriver ? match.passengerId : match.driverId;

  return {
    _id: match._id,
    status: match.status,
    driverApproved: Boolean(match.driverApproved),
    passengerApproved: Boolean(match.passengerApproved),
    rideId: ride?._id || match.rideId,
    requestId: request?._id || match.requestId,
    bookingId: booking?._id || match.bookingId,
    ride: ride
      ? {
          _id: ride._id,
          fromCity: ride.fromCity,
          toCity: ride.toCity,
          date: ride.date,
          time: ride.time,
          dateTime: ride.dateTime,
          status: ride.status,
          pricePerSeat: ride.pricePerSeat,
          totalSeats: ride.totalSeats,
          bookedSeats: ride.bookedSeats,
          availableSeats: ride.availableSeats,
        }
      : undefined,
    otherUser: otherUser
      ? {
          id: otherUser._id || otherUser.id,
          name: otherUser.name,
          profileImage: otherUser.profilePhoto || "",
          mobile: match.status === "approved" ? otherUser.phone || "" : "",
        }
      : undefined,
    createdAt: match.createdAt,
  };
};

const findBestRideForRequest = async ({ request, driverId }) => {
  const query = {
    driver: driverId,
    status: { $nin: ["completed", "cancelled", "expired"] },
  };

  const rides = await Ride.find(query).sort({ dateTime: 1, createdAt: -1 });
  return rides.find((ride) => isRouteMatch(ride, request) && isDateTimeMatch(ride.dateTime, request.dateTime));
};

const findBestRequestForRide = async ({ ride, passengerId }) => {
  const query = {
    passengerId,
    status: { $in: ["open", "scheduled", "matched"] },
  };

  const requests = await RideRequest.find(query).sort({ dateTime: 1, createdAt: -1 });
  return requests.find((request) => isRouteMatch(ride, request) && isDateTimeMatch(ride.dateTime, request.dateTime));
};

const ensureBookingForMatch = async ({ ride, request }) => {
  let booking = await Booking.findOne({
    rideId: ride._id,
    passengerId: request.passengerId,
    status: { $in: ["pending", "accepted", "booked", "ongoing", "completed"] },
  }).sort({ createdAt: -1 });

  if (booking) {
    return booking;
  }

  const requestedSeats = Math.max(1, Number(request.seatsNeeded || 1));
  const seats = Math.min(requestedSeats, Math.max(1, Number(ride.totalSeats || requestedSeats)));

  booking = await Booking.create({
    passengerId: request.passengerId,
    user: request.passengerId,
    rideId: ride._id,
    ride: ride._id,
    seatsRequested: seats,
    seatsBooked: seats,
    totalPrice: Number(ride.pricePerSeat || 0) * seats,
    status: "pending",
  });

  return booking;
};

const finalizeMatchIfApproved = async ({ match, ride, request, booking, actorUserId }) => {
  const bothApproved = Boolean(match.driverApproved) && Boolean(match.passengerApproved);

  if (match.status === "approved" && bothApproved) {
    return match;
  }

  match.status = bothApproved ? "approved" : "pending";
  match.rideId = ride._id;
  match.requestId = request._id;
  match.bookingId = booking._id;
  await match.save();

  if (!bothApproved) {
    const actorIsDriver = String(actorUserId) === String(match.driverId);
    const targetUserId = actorIsDriver ? match.passengerId : match.driverId;

    await createUserNotification({
      userId: targetUserId,
      type: "ride_request",
      title: "Ride matched",
      body: "Your ride has been matched. Please approve.",
      data: {
        matchId: match._id,
        rideId: ride._id,
        requestId: request._id,
      },
      pushFallback: true,
    });

    const io = getIo();
    if (io) {
      io.to(`user:${String(targetUserId)}`).emit("ride_matched", {
        matchId: String(match._id),
        rideId: String(ride._id),
        requestId: String(request._id),
        status: "pending",
      });
    }

    return match;
  }

  const seatsToReserve = 1;
  const reserveResult = await Ride.updateOne(
    {
      _id: ride._id,
      availableSeats: { $gte: seatsToReserve },
      status: { $in: ["scheduled", "nearby", "live", "ongoing"] },
    },
    {
      $inc: {
        bookedSeats: seatsToReserve,
        availableSeats: -seatsToReserve,
      },
    }
  );

  if (!reserveResult?.modifiedCount) {
    match.status = "pending";
    match.driverApproved = false;
    match.passengerApproved = false;
    await match.save();
    throw Object.assign(new Error("Ride is full"), { statusCode: 400 });
  }

  booking.seatsRequested = Math.max(1, Number(booking.seatsRequested || 1));
  booking.seatsBooked = 1;
  booking.totalPrice = Number(ride.pricePerSeat || 0);
  booking.status = "accepted";
  await booking.save();

  request.status = "matched";
  request.matchedRideId = ride._id;
  request.matchedBookingId = booking._id;
  await request.save();

  const freshRide = await Ride.findById(ride._id);
  if (freshRide && !["completed", "cancelled", "expired"].includes(String(freshRide.status))) {
    const { date, time } = getRideDateParts(freshRide.dateTime || `${freshRide.date}T${freshRide.time}:00`);
    freshRide.date = date;
    freshRide.time = time;
    await freshRide.save();
  }

  const actorIsDriver = String(actorUserId) === String(match.driverId);
  const targetUserId = actorIsDriver ? match.passengerId : match.driverId;

  await createUserNotification({
    userId: targetUserId,
    type: "ride_request",
    title: "Ride approved",
    body: "Your ride match is approved. You can now chat.",
    data: {
      matchId: match._id,
      rideId: ride._id,
      requestId: request._id,
      approved: true,
    },
    pushFallback: true,
  });

  const io = getIo();
  if (io) {
    const rideAcceptedPayload = {
      matchId: String(match._id),
      rideId: String(ride._id),
      requestId: String(request._id),
      bookingId: String(booking._id),
      status: "approved",
    };

    io.to(`user:${String(match.driverId)}`).emit("ride_accepted", rideAcceptedPayload);
    io.to(`user:${String(match.passengerId)}`).emit("ride_accepted", rideAcceptedPayload);
  }

  return match;
};

const resolveRideAndRequestFromPayload = async ({ role, userId, rideId, requestId }) => {
  let ride = null;
  let request = null;

  if (rideId) {
    ride = await Ride.findById(rideId);
  }

  if (requestId) {
    request = await RideRequest.findById(requestId);
  }

  if (role === "driver") {
    if (ride && String(ride.driver) !== String(userId)) {
      return { error: { status: 403, message: "You can only accept matches for your own rides" } };
    }

    if (!ride && request) {
      ride = await findBestRideForRequest({ request, driverId: userId });
    }

    if (!request && ride) {
      const existingPendingMatch = await Match.findOne({
        rideId: ride._id,
        status: "pending",
        passengerApproved: true,
        driverApproved: false,
      }).sort({ createdAt: -1 });

      if (existingPendingMatch?.requestId) {
        request = await RideRequest.findById(existingPendingMatch.requestId);
      }

      if (request && (!isRouteMatch(ride, request) || !isDateTimeMatch(ride.dateTime, request.dateTime))) {
        request = null;
      }

      if (!request) {
        request = await RideRequest.findOne({
          status: { $in: ["open", "scheduled", "matched"] },
        }).sort({ createdAt: -1 });

        if (request && !isRouteMatch(ride, request)) {
          request = await findBestRequestForRide({ ride, passengerId: request.passengerId });
        }

        if (request && !isDateTimeMatch(ride.dateTime, request.dateTime)) {
          request = null;
        }
      }

      if (!request) {
        const candidates = await RideRequest.find({ status: { $in: ["open", "scheduled", "matched"] } }).sort({ dateTime: 1, createdAt: -1 });
        request = candidates.find((item) => isRouteMatch(ride, item) && isDateTimeMatch(ride.dateTime, item.dateTime));
      }
    }
  }

  if (role === "passenger") {
    if (request && String(request.passengerId) !== String(userId)) {
      return { error: { status: 403, message: "You can only accept matches for your own requests" } };
    }

    if (!request && ride) {
      request = await findBestRequestForRide({ ride, passengerId: userId });
    }

    if (!ride && request) {
      const existingPendingMatch = await Match.findOne({
        requestId: request._id,
        status: "pending",
        driverApproved: true,
        passengerApproved: false,
      }).sort({ createdAt: -1 });

      if (existingPendingMatch?.rideId) {
        ride = await Ride.findById(existingPendingMatch.rideId);
      }

      if (ride && (!isRouteMatch(ride, request) || !isDateTimeMatch(ride.dateTime, request.dateTime))) {
        ride = null;
      }

      if (!ride) {
        const candidates = await Ride.find({
          status: { $nin: ["completed", "cancelled", "expired"] },
        }).sort({ dateTime: 1, createdAt: -1 });

        ride = candidates.find((item) => isRouteMatch(item, request) && isDateTimeMatch(item.dateTime, request.dateTime));
      }
    }
  }

  if (!ride || !request) {
    return { error: { status: 404, message: "No matching ride/request found for acceptance" } };
  }

  if (!isRouteMatch(ride, request) || !isDateTimeMatch(ride.dateTime, request.dateTime)) {
    return { error: { status: 400, message: "Ride and request do not match route/date/time" } };
  }

  return { ride, request };
};

export const acceptRideMatch = async (req, res, next) => {
  try {
    const role = String(req.user?.role || "");
    const { rideId, requestId } = req.body || {};

    if (!["driver", "passenger"].includes(role)) {
      return res.status(403).json({ message: "Only passengers and drivers can accept matches" });
    }

    if (!rideId && !requestId) {
      return res.status(400).json({ message: "rideId or requestId is required" });
    }

    const resolved = await resolveRideAndRequestFromPayload({
      role,
      userId: req.user._id,
      rideId,
      requestId,
    });

    if (resolved.error) {
      return res.status(resolved.error.status).json({ message: resolved.error.message });
    }

    const { ride, request } = resolved;

    let match = await Match.findOne({
      rideId: ride._id,
      passengerId: request.passengerId,
    });

    const booking = await ensureBookingForMatch({ ride, request });

    if (!match) {
      match = await Match.create({
        rideId: ride._id,
        requestId: request._id,
        bookingId: booking._id,
        driverId: ride.driver,
        passengerId: request.passengerId,
        status: "pending",
        driverApproved: false,
        passengerApproved: false,
      });
    }

    if (String(req.user._id) === String(match.driverId)) {
      match.driverApproved = true;
    }

    if (String(req.user._id) === String(match.passengerId)) {
      match.passengerApproved = true;
    }

    await finalizeMatchIfApproved({
      match,
      ride,
      request,
      booking,
      actorUserId: req.user._id,
    });

    const populatedMatch = await Match.findById(match._id)
      .populate("driverId", "name profilePhoto phone")
      .populate("passengerId", "name profilePhoto phone")
      .populate("rideId", "fromCity toCity date time dateTime status pricePerSeat totalSeats bookedSeats availableSeats")
      .populate("requestId", "fromCity toCity dateTime seatsNeeded status")
      .populate("bookingId", "status seatsBooked totalPrice");

    return res.json({
      message: populatedMatch.status === "approved" ? "Ride match approved" : "Ride match pending approval",
      match: buildMatchResponse({
        match: populatedMatch,
        ride: populatedMatch.rideId,
        request: populatedMatch.requestId,
        booking: populatedMatch.bookingId,
        meId: req.user._id,
      }),
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ message: error.message || "Ride is full" });
    }

    return next(error);
  }
};

export const approveRideMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const isDriver = String(match.driverId) === String(req.user._id);
    const isPassenger = String(match.passengerId) === String(req.user._id);

    if (!isDriver && !isPassenger && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only ride participants can approve match" });
    }

    if (isDriver || req.user.role === "admin") {
      match.driverApproved = true;
    }

    if (isPassenger || req.user.role === "admin") {
      match.passengerApproved = true;
    }

    const ride = await Ride.findById(match.rideId);
    const request = await RideRequest.findById(match.requestId);
    const booking = await Booking.findById(match.bookingId);

    if (!ride || !request || !booking) {
      return res.status(400).json({ message: "Match links are invalid" });
    }

    await finalizeMatchIfApproved({
      match,
      ride,
      request,
      booking,
      actorUserId: req.user._id,
    });

    const populatedMatch = await Match.findById(match._id)
      .populate("driverId", "name profilePhoto phone")
      .populate("passengerId", "name profilePhoto phone")
      .populate("rideId", "fromCity toCity date time dateTime status pricePerSeat totalSeats bookedSeats availableSeats")
      .populate("requestId", "fromCity toCity dateTime seatsNeeded status")
      .populate("bookingId", "status seatsBooked totalPrice");

    return res.json({
      message: populatedMatch.status === "approved" ? "Ride match approved" : "Ride match pending approval",
      match: buildMatchResponse({
        match: populatedMatch,
        ride: populatedMatch.rideId,
        request: populatedMatch.requestId,
        booking: populatedMatch.bookingId,
        meId: req.user._id,
      }),
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ message: error.message || "Ride is full" });
    }

    return next(error);
  }
};

export const getMyMatchedTrips = async (req, res, next) => {
  try {
    const desiredStatus = String(req.query?.status || "approved").trim().toLowerCase();
    const statusFilter = ["approved", "pending"].includes(desiredStatus) ? desiredStatus : "approved";

    const query = {
      status: statusFilter,
      $or: [{ driverId: req.user._id }, { passengerId: req.user._id }],
    };

    const matches = await Match.find(query)
      .populate("driverId", "name profilePhoto phone")
      .populate("passengerId", "name profilePhoto phone")
      .populate("rideId", "fromCity toCity date time dateTime status pricePerSeat totalSeats bookedSeats availableSeats")
      .populate("requestId", "fromCity toCity dateTime seatsNeeded status")
      .populate("bookingId", "status seatsBooked totalPrice")
      .sort({ createdAt: -1 });

    const payload = matches
      .filter((item) => item.rideId)
      .map((item) =>
        buildMatchResponse({
          match: item,
          ride: item.rideId,
          request: item.requestId,
          booking: item.bookingId,
          meId: req.user._id,
        })
      );

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};
