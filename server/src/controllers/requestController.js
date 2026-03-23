import { RideRequest } from "../models/RideRequest.js";
import { Ride } from "../models/Ride.js";
import { Booking } from "../models/Booking.js";

const NEARBY_WINDOW_HOURS = 24;

const classifyRequestStatus = (dateTime, baseStatus) => {
  if (baseStatus === "completed") {
    return "completed";
  }

  const start = new Date(dateTime);
  if (Number.isNaN(start.getTime())) {
    return "scheduled";
  }

  const now = new Date();
  if (start <= now) {
    return "live";
  }

  const nearbyUntil = new Date(now.getTime() + NEARBY_WINDOW_HOURS * 60 * 60 * 1000);
  if (start <= nearbyUntil) {
    return "nearby";
  }

  return "scheduled";
};

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const createRideRequest = async (req, res, next) => {
  try {
    const { fromCity, toCity, fromCoordinates, toCoordinates, dateTime, seatsNeeded } = req.body;

    if (req.user.role !== "passenger") {
      return res.status(403).json({ message: "Passengers only" });
    }

    if (!fromCity || !toCity || !fromCoordinates?.lat || !fromCoordinates?.lng || !toCoordinates?.lat || !toCoordinates?.lng || !dateTime || !seatsNeeded) {
      return res.status(400).json({ message: "All ride request fields are required" });
    }

    const request = await RideRequest.create({
      passengerId: req.user._id,
      fromCity: fromCity.trim(),
      toCity: toCity.trim(),
      fromCoordinates: {
        lat: Number(fromCoordinates.lat),
        lng: Number(fromCoordinates.lng),
      },
      toCoordinates: {
        lat: Number(toCoordinates.lat),
        lng: Number(toCoordinates.lng),
      },
      dateTime: new Date(dateTime),
      seatsNeeded: Number(seatsNeeded),
      status: "open",
    });

    const populated = await RideRequest.findById(request._id).populate(
      "passengerId",
      "name rating isVerified profilePhoto"
    );

    return res.status(201).json(populated);
  } catch (error) {
    return next(error);
  }
};

export const getNearbyRideRequests = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Drivers only" });
    }

    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);
    const fromCity = String(req.query?.fromCity || "").trim();
    const toCity = String(req.query?.toCity || "").trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid lat and lng query params are required" });
    }

    const requests = await RideRequest.find({
      status: "open",
      ...(fromCity ? { fromCity: new RegExp(fromCity, "i") } : {}),
      ...(toCity ? { toCity: new RegExp(toCity, "i") } : {}),
    })
      .populate("passengerId", "name rating isVerified profilePhoto")
      .sort({ dateTime: 1, createdAt: -1 });

    const nearbyRequests = requests
      .map((item) => {
        const reqLat = Number(item.fromCoordinates?.lat);
        const reqLng = Number(item.fromCoordinates?.lng);

        if (!Number.isFinite(reqLat) || !Number.isFinite(reqLng)) {
          return null;
        }

        const distanceKm = calculateDistanceKm(lat, lng, reqLat, reqLng);

        return {
          ...item.toObject(),
          distanceKm: Number(distanceKm.toFixed(2)),
          timeClass: classifyRequestStatus(item.dateTime, item.status),
        };
      })
      .filter((item) => item && item.distanceKm < 50)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json(nearbyRequests);
  } catch (error) {
    return next(error);
  }
};

export const getMyRideRequests = async (req, res, next) => {
  try {
    if (req.user.role !== "passenger") {
      return res.status(403).json({ message: "Passengers only" });
    }

    const requests = await RideRequest.find({ passengerId: req.user._id })
      .populate("passengerId", "name rating isVerified profilePhoto")
      .sort({ dateTime: 1, createdAt: -1 });

    const normalized = requests.map((request) => ({
      ...request.toObject(),
      timeClass: classifyRequestStatus(request.dateTime, request.status),
    }));

    return res.json(normalized);
  } catch (error) {
    return next(error);
  }
};

export const getRideRequestById = async (req, res, next) => {
  try {
    const request = await RideRequest.findById(req.params.requestId).populate(
      "passengerId",
      "name rating isVerified profilePhoto"
    );

    if (!request) {
      return res.status(404).json({ message: "Ride request not found" });
    }

    if (req.user.role === "passenger" && String(request.passengerId?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role !== "driver" && req.user.role !== "passenger") {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(request);
  } catch (error) {
    return next(error);
  }
};

export const acceptRideRequest = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Drivers only" });
    }

    if (!req.user.isVerified) {
      return res.status(403).json({ message: "Driver verification is required" });
    }

    const request = await RideRequest.findById(req.params.requestId);

    if (!request || request.status !== "open") {
      return res.status(404).json({ message: "Open ride request not found" });
    }

    const ride = await Ride.create({
      driver: req.user._id,
      fromCity: request.fromCity,
      toCity: request.toCity,
      date: new Date(request.dateTime).toISOString().slice(0, 10),
      time: new Date(request.dateTime).toISOString().slice(11, 16),
      dateTime: request.dateTime,
      pricePerSeat: 100,
      totalSeats: request.seatsNeeded,
      bookedSeats: request.seatsNeeded,
      availableSeats: 0,
      fromCoordinates: request.fromCoordinates,
      toCoordinates: request.toCoordinates,
      status: "scheduled",
    });

    const booking = await Booking.create({
      passengerId: request.passengerId,
      rideId: ride._id,
      user: request.passengerId,
      ride: ride._id,
      seatsRequested: request.seatsNeeded,
      seatsBooked: request.seatsNeeded,
      totalPrice: request.seatsNeeded * ride.pricePerSeat,
      status: "accepted",
    });

    request.status = "matched";
    request.matchedRideId = ride._id;
    request.matchedBookingId = booking._id;
    await request.save();

    return res.json({ request, ride, booking });
  } catch (error) {
    return next(error);
  }
};
