import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";
import { Ride } from "../models/Ride.js";
import { User } from "../models/User.js";

const recalculateUserRating = async (targetUserId) => {
  const aggregates = await Review.aggregate([
    { $match: { targetUserId } },
    {
      $group: {
        _id: "$targetUserId",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const avgRating = aggregates[0]?.avgRating || 5;
  const ratingCount = aggregates[0]?.count || 0;

  await User.findByIdAndUpdate(targetUserId, {
    rating: Number(avgRating.toFixed(2)),
    ratingCount,
  });
};

export const createReview = async (req, res, next) => {
  try {
    const { rideId, targetUserId, rating, reviewText } = req.body;

    if (!rideId || !targetUserId || !rating) {
      return res.status(400).json({ message: "rideId, targetUserId and rating are required" });
    }

    const ride = await Ride.findById(rideId).select("driver status");

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.status !== "completed") {
      return res.status(400).json({ message: "Reviews can only be submitted after ride completion" });
    }

    const isDriver = String(ride.driver) === String(req.user._id);
    const hasBooking = await Booking.exists({ ride: rideId, user: req.user._id });

    if (!isDriver && !hasBooking) {
      return res.status(403).json({ message: "Only ride participants can submit reviews" });
    }

    const review = await Review.findOneAndUpdate(
      { reviewerId: req.user._id, targetUserId, rideId },
      {
        reviewerId: req.user._id,
        targetUserId,
        rideId,
        rating: Number(rating),
        reviewText: reviewText?.trim() || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await recalculateUserRating(targetUserId);

    return res.status(201).json(review);
  } catch (error) {
    return next(error);
  }
};

export const getReviewsForUser = async (req, res, next) => {
  try {
    const reviews = await Review.find({ targetUserId: req.params.userId })
      .populate("reviewerId", "name rating isVerified")
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (error) {
    return next(error);
  }
};
