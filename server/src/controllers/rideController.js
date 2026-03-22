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

    const populatedRide = await Ride.findById(ride._id).populate("driver", "name email phone role rating isVerified");
    return res.status(201).json(populatedRide);
  } catch (error) {
    return next(error);
  }
};

export const searchRides = async (req, res, next) => {
  try {
    const { from, to, date, sort = "time" } = req.query;

    const query = {
      ...(from ? { fromCity: new RegExp(`^${from.trim()}$`, "i") } : {}),
      ...(to ? { toCity: new RegExp(`^${to.trim()}$`, "i") } : {}),
      ...(date ? { date } : {}),
      availableSeats: { $gt: 0 },
      status: { $in: ["pending", "ongoing"] },
    };

    const sortOption = sort === "price" ? { pricePerSeat: 1, createdAt: -1 } : { date: 1, time: 1, createdAt: -1 };

    const rides = await Ride.find(query).populate("driver", "name email phone role rating isVerified").sort(sortOption);

    return res.json(rides);
  } catch (error) {
    return next(error);
  }
};

export const getRideById = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).populate("driver", "name email phone role rating isVerified");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (["ongoing", "completed", "cancelled"].includes(status)) {
      await Booking.updateMany({ ride: ride._id, status: { $ne: "cancelled" } }, { status });
    }

    return res.json(ride);
  } catch (error) {
    return next(error);
  }
};

export const getMyRides = async (req, res, next) => {
  try {
    const rides = await Ride.find({ driver: req.user._id })
      .populate("driver", "name email phone role rating isVerified")
      .sort({ date: 1, time: 1, createdAt: -1 });

    return res.json(rides);
  } catch (error) {
    return next(error);
  }
};

export const updateRideStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !["pending", "ongoing", "completed", "cancelled"].includes(status)) {
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

    return res.json(ride);
  } catch (error) {
    return next(error);
  }
};
