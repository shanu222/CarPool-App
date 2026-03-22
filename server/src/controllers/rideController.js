import { Ride } from "../models/Ride.js";

export const createRide = async (req, res, next) => {
  try {
    const { fromCity, toCity, date, time, pricePerSeat, totalSeats } = req.body;

    if (!fromCity || !toCity || !date || !time || !pricePerSeat || !totalSeats) {
      return res.status(400).json({ message: "All ride fields are required" });
    }

    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) {
      return res.status(400).json({ message: "fromCity and toCity cannot be same" });
    }

    const ride = await Ride.create({
      driver: req.user._id,
      fromCity: fromCity.trim(),
      toCity: toCity.trim(),
      date,
      time,
      pricePerSeat: Number(pricePerSeat),
      totalSeats: Number(totalSeats),
      availableSeats: Number(totalSeats),
    });

    const populatedRide = await Ride.findById(ride._id).populate("driver", "name email phone role rating");
    return res.status(201).json(populatedRide);
  } catch (error) {
    return next(error);
  }
};

export const searchRides = async (req, res, next) => {
  try {
    const { from, to, date } = req.query;

    const query = {
      ...(from ? { fromCity: new RegExp(`^${from.trim()}$`, "i") } : {}),
      ...(to ? { toCity: new RegExp(`^${to.trim()}$`, "i") } : {}),
      ...(date ? { date } : {}),
      availableSeats: { $gt: 0 },
    };

    const rides = await Ride.find(query)
      .populate("driver", "name email phone role rating")
      .sort({ date: 1, time: 1, createdAt: -1 });

    return res.json(rides);
  } catch (error) {
    return next(error);
  }
};

export const getRideById = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id).populate("driver", "name email phone role rating");

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
      .populate("driver", "name email phone role rating")
      .sort({ date: 1, time: 1, createdAt: -1 });

    return res.json(rides);
  } catch (error) {
    return next(error);
  }
};
