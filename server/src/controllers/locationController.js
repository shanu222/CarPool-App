import { Location } from "../models/Location.js";

export const getLatestRideLocation = async (req, res, next) => {
  try {
    const location = await Location.findOne({ rideId: req.params.rideId }).sort({ updatedAt: -1 });

    if (!location) {
      return res.status(404).json({ message: "No location found" });
    }

    return res.json(location);
  } catch (error) {
    return next(error);
  }
};

export const getRideLocationHistory = async (req, res, next) => {
  try {
    const items = await Location.find({ rideId: req.params.rideId })
      .sort({ updatedAt: -1 })
      .limit(200);

    return res.json(items);
  } catch (error) {
    return next(error);
  }
};
