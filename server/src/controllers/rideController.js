import { Ride } from "../models/Ride.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { Booking } from "../models/Booking.js";
import { geocodeCity, getDistanceAndDuration } from "../services/mapsService.js";
import { sendPushNotification } from "../services/pushService.js";

export const createRide = async (req, res, next) => {
  try {
    const { fromCity, toCity, date, time, pricePerSeat, totalSeats, availableSeats } = req.body;
    const requestedSeats = Number(availableSeats ?? totalSeats);

    if (!req.user?.isVerified) {
      return res.status(403).json({ message: "Driver verification is required before posting rides" });
    }

    if (!req.user?.canPostRide) {
      return res.status(403).json({ message: "Ride posting is locked. Please submit payment proof for approval." });
    }

    if (!fromCity || !toCity || !date || !time || !pricePerSeat || !requestedSeats) {
      return res.status(400).json({ message: "All ride fields are required" });
    }

    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) {
      return res.status(400).json({ message: "fromCity and toCity cannot be same" });
    }

    const [fromCoordinates, toCoordinates] = await Promise.all([
      geocodeCity(fromCity.trim()),
      geocodeCity(toCity.trim()),
    ]);

    const routeMeta = await getDistanceAndDuration(fromCoordinates, toCoordinates);

    const ride = await Ride.create({
      driver: req.user._id,
      fromCity: fromCity.trim(),
      toCity: toCity.trim(),
      date,
      time,
      pricePerSeat: Number(pricePerSeat),
      totalSeats: requestedSeats,
      availableSeats: requestedSeats,
      fromCoordinates: fromCoordinates || undefined,
      toCoordinates: toCoordinates || undefined,
      distanceText: routeMeta?.distanceText,
      durationText: routeMeta?.durationText,
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
      "name email phone role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
    );
    return res.status(201).json(populatedRide);
  } catch (error) {
    return next(error);
  }
};

export const searchRides = async (req, res, next) => {
  try {
    const { from, to, date, sort = "time", type, route } = req.query;

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === "passenger" && !(req.user.cnicNumber || req.user.cnic)) {
      return res.status(403).json({ message: "Please submit CNIC in profile verification before viewing rides" });
    }

    const now = new Date();
    const nowDate = now.toISOString().slice(0, 10);
    const nowTime = now.toTimeString().slice(0, 5);

    const andConditions = [
      ...(from ? [{ fromCity: new RegExp(from.trim(), "i") }] : []),
      ...(to ? [{ toCity: new RegExp(to.trim(), "i") }] : []),
      ...(date ? [{ date }] : []),
      { availableSeats: { $gt: 0 } },
      { status: { $in: ["scheduled", "ongoing"] } },
    ];

    if (route?.trim()) {
      const routeRegex = new RegExp(route.trim(), "i");
      andConditions.push({ $or: [{ fromCity: routeRegex }, { toCity: routeRegex }] });
    }

    if (type === "live") {
      andConditions.push({ status: "ongoing" });
    }

    if (type === "upcoming") {
      andConditions.push({ status: "scheduled" });
      andConditions.push({
        $or: [{ date: { $gt: nowDate } }, { date: nowDate, time: { $gte: nowTime } }],
      });
    }

    const query = andConditions.length ? { $and: andConditions } : {};

    const sortOption =
      sort === "price"
        ? { featured: -1, status: 1, pricePerSeat: 1, createdAt: -1 }
        : { featured: -1, status: 1, date: 1, time: 1, createdAt: -1 };

    const rides = await Ride.find(query)
      .populate(
        "driver",
        "name email phone role rating isVerified profilePhoto cnicNumber cnic carMake carModel carColor carPlateNumber carYear carPhoto"
      )
      .sort(sortOption);

    const liveRides = rides.filter((ride) => ride.status === "ongoing");
    const upcomingRides = rides.filter((ride) => {
      if (ride.status !== "scheduled") {
        return false;
      }

      if (ride.date > nowDate) {
        return true;
      }

      return ride.date === nowDate ? ride.time >= nowTime : false;
    });

    return res.json({
      liveRides,
      upcomingRides,
      rides: [...liveRides, ...upcomingRides],
    });
  } catch (error) {
    return next(error);
  }
};

export const getRideById = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).populate(
      "driver",
      "name email phone role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
    );

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    return res.json(ride);
  } catch (error) {
    return next(error);
  }
};

export const getMyRides = async (req, res, next) => {
  try {
    const rides = await Ride.find({ driver: req.user._id })
      .populate(
        "driver",
        "name email phone role rating isVerified profilePhoto carMake carModel carColor carPlateNumber carYear carPhoto"
      )
      .sort({ date: 1, time: 1, createdAt: -1 });

    return res.json(rides);
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

    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      { status },
      { new: true }
    ).populate("driver", "name email phone role rating isVerified");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (["ongoing", "completed", "cancelled"].includes(status)) {
      const nextBookingStatus = status === "cancelled" ? "cancelled" : status;
      await Booking.updateMany(
        { rideId: ride._id, status: { $in: ["accepted", "ongoing"] } },
        { status: nextBookingStatus }
      );
    }

    return res.json(ride);
  } catch (error) {
    return next(error);
  }
};
