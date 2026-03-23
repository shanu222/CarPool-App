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

const parseRideDateTime = (date, time) => {
  const value = new Date(`${date}T${time}:00`);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value;
};

const deriveStatusFromDateTime = (dateTime, now = new Date()) => {
  if (dateTime <= now) {
    return "ongoing";
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
  await Ride.updateMany(
    {
      status: "scheduled",
      dateTime: { $lte: now },
    },
    {
      $set: { status: "ongoing" },
    }
  );

  const completedBefore = new Date(now.getTime() - RIDE_AUTO_COMPLETE_HOURS * 60 * 60 * 1000);

  await Ride.updateMany(
    {
      status: "ongoing",
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
      sort = "time",
      type,
      route,
      userLat,
      userLng,
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
    const queryLat = Number(userLat);
    const queryLng = Number(userLng);
    const hasUserLocation = Number.isFinite(queryLat) && Number.isFinite(queryLng);

    if (!hasUserLocation) {
      return res.status(400).json({ message: "userLat and userLng are required" });
    }

    if (!isWithinPakistanBounds({ lat: queryLat, lng: queryLng })) {
      return res.status(400).json({ message: "Only Pakistani cities allowed" });
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

    const now = new Date();
    const nowDate = now.toISOString().slice(0, 10);
    const nowTime = now.toTimeString().slice(0, 5);

    const andConditions = [
      { driver: { $ne: req.user._id } },
      ...(date ? [{ date }] : []),
      { availableSeats: { $gt: 0 } },
      { status: { $in: ["scheduled", "ongoing"] } },
      { "fromCoordinates.lat": { $gte: PAKISTAN_BOUNDS.minLat, $lte: PAKISTAN_BOUNDS.maxLat } },
      { "fromCoordinates.lng": { $gte: PAKISTAN_BOUNDS.minLng, $lte: PAKISTAN_BOUNDS.maxLng } },
      { "toCoordinates.lat": { $gte: PAKISTAN_BOUNDS.minLat, $lte: PAKISTAN_BOUNDS.maxLat } },
      { "toCoordinates.lng": { $gte: PAKISTAN_BOUNDS.minLng, $lte: PAKISTAN_BOUNDS.maxLng } },
    ];

    if (route?.trim()) {
      const routeRegex = new RegExp(route.trim(), "i");
      andConditions.push({ $or: [{ fromCity: routeRegex }, { toCity: routeRegex }] });
    }

    if (type === "live" || type === "ongoing") {
      andConditions.push({ status: "ongoing" });
    }

    if (type === "upcoming" || type === "scheduled") {
      andConditions.push({ status: "scheduled" });
      andConditions.push({
        $or: [{ dateTime: { $gt: now } }, { date: { $gt: nowDate } }, { date: nowDate, time: { $gte: nowTime } }],
      });
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
        const rideFromLat = Number(ride.fromCoordinates?.lat);
        const rideFromLng = Number(ride.fromCoordinates?.lng);
        const rideToLat = Number(ride.toCoordinates?.lat);
        const rideToLng = Number(ride.toCoordinates?.lng);

        if (!Number.isFinite(rideFromLat) || !Number.isFinite(rideFromLng)) {
          return null;
        }

        const distanceKm = calculateDistanceKm(queryLat, queryLng, rideFromLat, rideFromLng);
        if (distanceKm >= 50) {
          return null;
        }

        const fromCityMatch = requestedFrom
          ? String(ride.fromCity || "").toLowerCase() === requestedFrom.toLowerCase()
          : true;

        const routeNearPassenger =
          Number.isFinite(rideToLat) && Number.isFinite(rideToLng)
            ? distancePointToSegmentKm(
                { lat: queryLat, lng: queryLng },
                { lat: rideFromLat, lng: rideFromLng },
                { lat: rideToLat, lng: rideToLng }
              ) <= 15
            : false;

        if (!fromCityMatch && !routeNearPassenger) {
          return null;
        }

        if (requestedTo) {
          const exactToMatch = String(ride.toCity || "").toLowerCase() === requestedTo.toLowerCase();

          if (!exactToMatch) {
            const passengerToCoords = toResolved?.coords;
            if (!passengerToCoords || !Number.isFinite(rideToLat) || !Number.isFinite(rideToLng)) {
              return null;
            }

            const rideSpan = calculateDistanceKm(rideFromLat, rideFromLng, rideToLat, rideToLng);
            const requestedSpan = calculateDistanceKm(
              rideFromLat,
              rideFromLng,
              passengerToCoords.lat,
              passengerToCoords.lng
            );

            if (rideSpan + 5 < requestedSpan) {
              return null;
            }
          }
        }

        return {
          ...ride.toObject(),
          distanceKm: Number(distanceKm.toFixed(2)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const ongoingRides = smartMatched.filter((ride) => ride.status === "ongoing");
    const scheduledRides = smartMatched.filter((ride) => {
      if (ride.status !== "scheduled") {
        return false;
      }

      if (ride.dateTime && new Date(ride.dateTime) > now) {
        return true;
      }

      if (ride.date > nowDate) {
        return true;
      }

      return ride.date === nowDate ? ride.time >= nowTime : false;
    });

    return res.json({
      ongoingRides,
      scheduledRides,
      liveRides: ongoingRides,
      upcomingRides: scheduledRides,
      rides: [...ongoingRides, ...scheduledRides],
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
    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Valid lat and lng query params are required" });
    }

    if (!isWithinPakistanBounds({ lat, lng })) {
      return res.status(400).json({ message: "Only Pakistani cities allowed" });
    }

    const baseQuery = {
      driver: { $ne: req.user?._id },
      status: { $in: ["scheduled", "ongoing"] },
      "fromCoordinates.lat": { $exists: true },
      "fromCoordinates.lng": { $exists: true },
    };

    const rideQuery = req.user?.role === "passenger"
      ? { ...baseQuery, availableSeats: { $gt: 0 } }
      : baseQuery;

    const rides = await Ride.find(rideQuery)
      .populate(
        "driver",
        "name role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
      )
      .sort({ featured: -1, dateTime: 1, createdAt: -1 });

    const nearbyRides = rides
      .map((ride) => {
        const rideLat = Number(ride.fromCoordinates?.lat);
        const rideLng = Number(ride.fromCoordinates?.lng);

        if (!Number.isFinite(rideLat) || !Number.isFinite(rideLng)) {
          return null;
        }

        const distanceKm = calculateDistanceKm(lat, lng, rideLat, rideLng);
        return {
          ...ride.toObject(),
          distanceKm: Number(distanceKm.toFixed(2)),
        };
      })
      .filter((ride) => ride && ride.distanceKm < 50)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json({
      nearbyRides,
      liveRides: nearbyRides.filter((ride) => ride.status === "ongoing"),
      scheduledRides: nearbyRides.filter((ride) => ride.status === "scheduled"),
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

    const ongoingRides = rides.filter((ride) => ride.status === "ongoing");
    const scheduledRides = rides.filter((ride) => ride.status === "scheduled");
    const completedRides = rides.filter((ride) => ride.status === "completed");

    return res.json({
      ongoingRides,
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

    if (!status || !["scheduled", "ongoing", "completed", "cancelled"].includes(status)) {
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

    if (["ongoing", "completed", "cancelled"].includes(status)) {
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
