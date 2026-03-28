import { Ride } from "../models/Ride.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { Booking } from "../models/Booking.js";
import { geocodeCity, getDistanceAndDuration } from "../services/mapsService.js";
import { sendPushNotification } from "../services/pushService.js";
import {
  getKnownPakistanCity,
  isKnownPakistanCity,
  isWithinPakistanBounds,
  PAKISTAN_BOUNDS,
  searchNominatimCity,
} from "../utils/pakistanLocation.js";

const RIDE_AUTO_COMPLETE_HOURS = Number(process.env.RIDE_AUTO_COMPLETE_HOURS || 6);
const RIDE_POSTING_WINDOW_DAYS = 15;
const NEARBY_WINDOW_HOURS = 24;

const parseRideDateTime = (date, time) => {
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value;
};

const deriveStatusFromDateTime = (dateTime, now = new Date()) => {
  if (dateTime <= now) {
    return "live";
  }

  const nearbyUntil = new Date(now.getTime() + NEARBY_WINDOW_HOURS * 60 * 60 * 1000);
  if (dateTime <= nearbyUntil) {
    return "nearby";
  }

  return "scheduled";
};

const isRideLive = (ride, now = new Date()) => {
  if (!ride) {
    return false;
  }

  const status = String(ride.status || "");
  if (status === "live") {
    return true;
  }

  if (["completed", "cancelled"].includes(status)) {
    return false;
  }

  const start = new Date(ride.startTime || ride.dateTime || 0);
  return !Number.isNaN(start.getTime()) && start <= now;
};

const toRadians = (value) => (value * Math.PI) / 180;

const normalizeCityName = (value) => String(value || "").trim().toLowerCase();

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

const distancePointToSegmentKm = (point, start, end) => {
  const ax = start.lng;
  const ay = start.lat;
  const bx = end.lng;
  const by = end.lat;
  const px = point.lng;
  const py = point.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abSquared = abx * abx + aby * aby;

  if (abSquared === 0) {
    return calculateDistanceKm(point.lat, point.lng, start.lat, start.lng);
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abSquared));
  const nearest = {
    lng: ax + abx * t,
    lat: ay + aby * t,
  };

  return calculateDistanceKm(point.lat, point.lng, nearest.lat, nearest.lng);
};

const projectionRatioOnSegment = (point, start, end) => {
  const ax = start.lng;
  const ay = start.lat;
  const bx = end.lng;
  const by = end.lat;
  const px = point.lng;
  const py = point.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abSquared = abx * abx + aby * aby;

  if (abSquared === 0) {
    return 0;
  }

  return (apx * abx + apy * aby) / abSquared;
};

const routeCoversRequestedSegment = (rideFrom, rideTo, requestedFrom, requestedTo) => {
  const maxDistanceFromPathKm = 30;
  const maxPointSnapDistanceKm = 35;
  const orderTolerance = 0.08;

  const startDistance = distancePointToSegmentKm(requestedFrom, rideFrom, rideTo);
  const endDistance = distancePointToSegmentKm(requestedTo, rideFrom, rideTo);

  if (startDistance > maxDistanceFromPathKm || endDistance > maxDistanceFromPathKm) {
    return false;
  }

  const tStart = projectionRatioOnSegment(requestedFrom, rideFrom, rideTo);
  const tEnd = projectionRatioOnSegment(requestedTo, rideFrom, rideTo);

  if (tStart > 1 + orderTolerance || tEnd < -orderTolerance || tStart > tEnd + orderTolerance) {
    return false;
  }

  const startCloseToRideStart = calculateDistanceKm(requestedFrom.lat, requestedFrom.lng, rideFrom.lat, rideFrom.lng) <= maxPointSnapDistanceKm;
  const endCloseToRideEnd = calculateDistanceKm(requestedTo.lat, requestedTo.lng, rideTo.lat, rideTo.lng) <= maxPointSnapDistanceKm;

  if (tStart < -orderTolerance && !startCloseToRideStart) {
    return false;
  }

  if (tEnd > 1 + orderTolerance && !endCloseToRideEnd) {
    return false;
  }

  return true;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const resolvePakistanCity = async (city) => {
  const trimmedCity = String(city || "").trim();

  if (!trimmedCity) {
    return null;
  }

  const knownCity = getKnownPakistanCity(trimmedCity);
  const inKnownList = Boolean(knownCity);

  if (inKnownList) {
    const coords =
      (await geocodeCity(`${knownCity}, Pakistan`)) ||
      (await geocodeCity(knownCity)) ||
      null;

    if (!coords || !isWithinPakistanBounds(coords)) {
      return null;
    }

    return {
      city: knownCity,
      coords,
    };
  }

  const nominatimResult = await searchNominatimCity(trimmedCity);
  if (!nominatimResult) {
    return null;
  }

  if (nominatimResult.country.toLowerCase() !== "pakistan") {
    return null;
  }

  if (!isWithinPakistanBounds({ lat: nominatimResult.lat, lng: nominatimResult.lng })) {
    return null;
  }

  return {
    city: trimmedCity,
    coords: {
      lat: nominatimResult.lat,
      lng: nominatimResult.lng,
    },
  };
};

const refreshRideLifecycleStatuses = async (now = new Date()) => {
  const nearbyUntil = new Date(now.getTime() + NEARBY_WINDOW_HOURS * 60 * 60 * 1000);

  await Ride.updateMany(
    {
      status: { $nin: ["completed", "cancelled"] },
      dateTime: { $lte: now },
    },
    {
      $set: { status: "live" },
    }
  );

  await Ride.updateMany(
    {
      status: { $nin: ["completed", "cancelled", "live"] },
      dateTime: { $gt: now, $lte: nearbyUntil },
    },
    {
      $set: { status: "nearby" },
    }
  );

  await Ride.updateMany(
    {
      status: { $nin: ["completed", "cancelled"] },
      dateTime: { $gt: nearbyUntil },
    },
    {
      $set: { status: "scheduled" },
    }
  );

  const completedBefore = new Date(now.getTime() - RIDE_AUTO_COMPLETE_HOURS * 60 * 60 * 1000);

  await Ride.updateMany(
    {
      status: "live",
      dateTime: { $lte: completedBefore },
    },
    {
      $set: { status: "completed" },
    }
  );
};

export const createRide = async (req, res, next) => {
  try {
    const { fromCity, toCity, date, time, pricePerSeat, totalSeats, availableSeats } = req.body;
    const requestedSeats = Number(availableSeats ?? totalSeats);
    const rideDateTime = parseRideDateTime(date, time);

    if (!req.user?.isVerified) {
      return res.status(403).json({ message: "Driver verification is required before posting rides" });
    }

    if (!fromCity || !toCity || !date || !time || !pricePerSeat || !requestedSeats) {
      return res.status(400).json({ message: "All ride fields are required" });
    }

    if (!rideDateTime) {
      return res.status(400).json({ message: "Invalid ride date/time" });
    }

    const todayStart = startOfDay(new Date());
    const maxAllowedDate = new Date(todayStart);
    maxAllowedDate.setDate(maxAllowedDate.getDate() + RIDE_POSTING_WINDOW_DAYS);
    maxAllowedDate.setHours(23, 59, 59, 999);

    if (rideDateTime > maxAllowedDate) {
      return res.status(400).json({ message: "You can only post rides within 15 days" });
    }

    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) {
      return res.status(400).json({ message: "fromCity and toCity cannot be same" });
    }

    const [fromResolved, toResolved] = await Promise.all([
      resolvePakistanCity(fromCity),
      resolvePakistanCity(toCity),
    ]);

    if (!fromResolved || !toResolved) {
      return res.status(400).json({ message: "Only Pakistani cities allowed" });
    }

    const fromCoordinates = fromResolved.coords;
    const toCoordinates = toResolved.coords;

    if (!isWithinPakistanBounds(fromCoordinates) || !isWithinPakistanBounds(toCoordinates)) {
      return res.status(400).json({ message: "Only Pakistani cities allowed" });
    }

    const routeMeta = await getDistanceAndDuration(fromCoordinates, toCoordinates);

    const ride = await Ride.create({
      driver: req.user._id,
      fromCity: fromResolved.city,
      toCity: toResolved.city,
      date,
      time,
      dateTime: rideDateTime,
      startTime: rideDateTime,
      pricePerSeat: Number(pricePerSeat),
      totalSeats: requestedSeats,
      bookedSeats: 0,
      availableSeats: requestedSeats,
      fromCoordinates: fromCoordinates || undefined,
      toCoordinates: toCoordinates || undefined,
      distanceText: routeMeta?.distanceText,
      durationText: routeMeta?.durationText,
      status: deriveStatusFromDateTime(rideDateTime),
    });

    const passengers = await User.find({ role: "passenger", _id: { $ne: req.user._id } })
      .select("_id fcmToken")
      .limit(200);

    if (passengers.length) {
      await Notification.insertMany(
        passengers.map((passenger) => ({
          user: passenger._id,
          type: "ride_posted",
          title: "New ride available",
          body: `${fromCity.trim()} to ${toCity.trim()} on ${date} at ${time}`,
          data: { rideId: ride._id },
        }))
      );

      await Promise.allSettled(
        passengers.map((passenger) =>
          sendPushNotification({
            token: passenger.fcmToken,
            title: "New ride posted",
            body: `${fromCity.trim()} → ${toCity.trim()} · ${date} ${time}`,
            data: { rideId: String(ride._id) },
          })
        )
      );
    }

    const populatedRide = await Ride.findById(ride._id).populate(
      "driver",
      "name role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
    );

    return res.status(201).json(populatedRide);
  } catch (error) {
    return next(error);
  }
};

export const searchRides = async (req, res, next) => {
  try {
    const {
      from,
      to,
      fromCity,
      toCity,
      date,
      dateTime,
      sort = "time",
      type,
      route,
      time,
    } = req.query;
    await refreshRideLifecycleStatuses();

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === "passenger" && !(req.user.cnicNumber || req.user.cnic)) {
      return res.status(403).json({ message: "Please submit CNIC in profile verification before viewing rides" });
    }

    const requestedFrom = String(fromCity || from || "").trim();
    const requestedTo = String(toCity || to || "").trim();
    const requestedDate = String(date || "").trim();
    const requestedTime = String(time || "").trim();
    const requestedDateTime =
      requestedDate && requestedTime ? parseRideDateTime(requestedDate, requestedTime) : null;

    if (requestedDate && requestedTime && !requestedDateTime) {
      return res.status(400).json({ message: "Invalid date/time" });
    }

    const [fromResolved, toResolved] = await Promise.all([
      requestedFrom ? resolvePakistanCity(requestedFrom) : Promise.resolve(null),
      requestedTo ? resolvePakistanCity(requestedTo) : Promise.resolve(null),
    ]);

    if (requestedFrom && !fromResolved) {
      return res.status(400).json({ message: "Only Pakistani cities allowed" });
    }

    if (requestedTo && !toResolved) {
      return res.status(400).json({ message: "Only Pakistani cities allowed" });
    }

    const andConditions = [
      { driver: { $ne: req.user._id } },
      ...(dateTime ? [{ dateTime: { $gte: new Date(String(dateTime)) } }] : []),
      { availableSeats: { $gt: 0 } },
      { status: { $in: ["scheduled", "nearby", "live"] } },
      { "fromCoordinates.lat": { $gte: PAKISTAN_BOUNDS.minLat, $lte: PAKISTAN_BOUNDS.maxLat } },
      { "fromCoordinates.lng": { $gte: PAKISTAN_BOUNDS.minLng, $lte: PAKISTAN_BOUNDS.maxLng } },
      { "toCoordinates.lat": { $gte: PAKISTAN_BOUNDS.minLat, $lte: PAKISTAN_BOUNDS.maxLat } },
      { "toCoordinates.lng": { $gte: PAKISTAN_BOUNDS.minLng, $lte: PAKISTAN_BOUNDS.maxLng } },
    ];

    if (route?.trim()) {
      const routeRegex = new RegExp(route.trim(), "i");
      andConditions.push({ $or: [{ fromCity: routeRegex }, { toCity: routeRegex }] });
    }

    if (type === "live") {
      andConditions.push({ status: "live" });
    }

    if (type === "upcoming" || type === "scheduled") {
      andConditions.push({ status: { $in: ["scheduled", "nearby"] } });
    }

    if (type === "all") {
      andConditions.push({ status: { $in: ["live", "scheduled", "nearby"] } });
    }

    const query = andConditions.length ? { $and: andConditions } : {};

    const sortOption =
      sort === "price"
        ? { featured: -1, status: 1, pricePerSeat: 1, dateTime: 1, createdAt: -1 }
        : { featured: -1, status: 1, dateTime: 1, createdAt: -1 };

    const rides = await Ride.find(query)
      .populate(
        "driver",
        "name role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
      )
      .sort(sortOption);

    const smartMatched = rides
      .map((ride) => {
        const rideObject = ride.toObject();
        const rideFromLat = Number(ride.fromCoordinates?.lat);
        const rideFromLng = Number(ride.fromCoordinates?.lng);
        const rideToLat = Number(ride.toCoordinates?.lat);
        const rideToLng = Number(ride.toCoordinates?.lng);

        if (!Number.isFinite(rideFromLat) || !Number.isFinite(rideFromLng)) {
          return null;
        }

        const normalizedRideStatus = ride.status === "nearby" ? "scheduled" : ride.status;

        if (!["live", "scheduled"].includes(String(normalizedRideStatus || ""))) {
          return null;
        }

        const rideFromPoint = { lat: rideFromLat, lng: rideFromLng };
        const rideToPoint =
          Number.isFinite(rideToLat) && Number.isFinite(rideToLng)
            ? { lat: rideToLat, lng: rideToLng }
            : null;

        if (requestedDate) {
          const rideDate = String(ride.date || "").trim();
          if (rideDate !== requestedDate) {
            return null;
          }
        }

        if (requestedTime && !requestedDate) {
          const rideTime = String(ride.time || "").trim();
          if (normalizedRideStatus !== "live" && rideTime && rideTime < requestedTime) {
            return null;
          }
        }

        if (requestedDateTime) {
          const rideStart = new Date(ride.dateTime || `${ride.date}T${ride.time}:00`);
          if (Number.isNaN(rideStart.getTime())) {
            return null;
          }

          if (normalizedRideStatus !== "live" && rideStart < requestedDateTime) {
            return null;
          }
        }

        const normalizedRideFrom = normalizeCityName(ride.fromCity);
        const normalizedRideTo = normalizeCityName(ride.toCity);
        const normalizedRequestedFrom = normalizeCityName(requestedFrom);
        const normalizedRequestedTo = normalizeCityName(requestedTo);

        const fromCityMatch = normalizedRequestedFrom
          ? normalizedRideFrom === normalizedRequestedFrom
          : true;
        const toCityMatch = normalizedRequestedTo
          ? normalizedRideTo === normalizedRequestedTo
          : true;
        const partialTextMatch =
          (!normalizedRequestedFrom || normalizedRideFrom.includes(normalizedRequestedFrom)) &&
          (!normalizedRequestedTo || normalizedRideTo.includes(normalizedRequestedTo));

        let routeCoverageMatch = false;

        if (fromResolved?.coords && toResolved?.coords && rideToPoint) {
          routeCoverageMatch = routeCoversRequestedSegment(
            rideFromPoint,
            rideToPoint,
            fromResolved.coords,
            toResolved.coords
          );
        }

        const cityFallbackMatch =
          (!normalizedRequestedFrom || fromCityMatch) &&
          (!normalizedRequestedTo || toCityMatch);

        const shouldIncludeByRoute =
          (!normalizedRequestedFrom && !normalizedRequestedTo) ||
          routeCoverageMatch ||
          cityFallbackMatch ||
          partialTextMatch;

        if (!shouldIncludeByRoute) {
          return null;
        }

        return {
          ...rideObject,
          status: normalizedRideStatus,
        };
      })
      .filter(Boolean);

    const liveRides = smartMatched.filter((ride) => ride.status === "live");
    const scheduledRides = smartMatched.filter((ride) => ride.status === "scheduled");

    return res.json({
      liveRides,
      nearbyRides: [],
      scheduledRides,
      ongoingRides: liveRides,
      upcomingRides: scheduledRides,
      rides: [...liveRides, ...scheduledRides],
    });
  } catch (error) {
    return next(error);
  }
};

export const getRideById = async (req, res, next) => {
  try {
    await refreshRideLifecycleStatuses();
    const ride = await Ride.findById(req.params.id).populate(
      "driver",
      "name role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
    );

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    return res.json(ride);
  } catch (error) {
    return next(error);
  }
};

export const getNearbyRides = async (req, res, next) => {
  try {
    await refreshRideLifecycleStatuses();

    const rides = await Ride.find({
      status: { $in: ["scheduled", "nearby", "live"] },
      "fromCoordinates.lat": { $exists: true },
      "fromCoordinates.lng": { $exists: true },
    })
      .populate(
        "driver",
        "name role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
      )
      .sort({ featured: -1, dateTime: 1, createdAt: -1 });

    const allRides = rides.map((ride) => ({
      ...ride.toObject(),
      status: ride.status === "nearby" ? "scheduled" : ride.status,
    }));

    const liveRides = allRides.filter((ride) => ride.status === "live");
    const scheduledRides = allRides.filter((ride) => ride.status === "scheduled");

    return res.json({
      nearbyRides: [...liveRides, ...scheduledRides],
      liveRides,
      nearbyWindowRides: [],
      scheduledRides,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyRides = async (req, res, next) => {
  try {
    await refreshRideLifecycleStatuses();
    const rides = await Ride.find({ driver: req.user._id })
      .populate(
        "driver",
        "name role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
      )
      .sort({ dateTime: 1, createdAt: -1 });

    const liveRides = rides.filter((ride) => ride.status === "live");
    const nearbyRides = rides.filter((ride) => ride.status === "nearby");
    const scheduledRides = rides.filter((ride) => ride.status === "scheduled");
    const completedRides = rides.filter((ride) => ride.status === "completed");

    return res.json({
      liveRides,
      nearbyRides,
      ongoingRides: liveRides,
      scheduledRides,
      completedRides,
      rides,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateRideStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !["scheduled", "nearby", "live", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Valid ride status is required" });
    }

    const currentRide = await Ride.findOne({ _id: req.params.id, driver: req.user._id });

    if (!currentRide) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (["completed", "cancelled"].includes(currentRide.status) && currentRide.status !== status) {
      return res.status(400).json({ message: "Completed or cancelled rides cannot be edited" });
    }

    currentRide.status = status;
    await currentRide.save();

    const ride = await Ride.findById(currentRide._id).populate("driver", "name role rating isVerified");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (["live", "completed", "cancelled"].includes(status)) {
      const nextBookingStatus = status === "cancelled" ? "cancelled" : status;
      await Booking.updateMany(
        { rideId: ride._id, status: { $in: ["accepted", "booked", "ongoing"] } },
        { status: nextBookingStatus }
      );
    }

    return res.json(ride);
  } catch (error) {
    return next(error);
  }
};
