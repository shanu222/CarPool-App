import { Booking } from "../models/Booking.js";
import { Ride } from "../models/Ride.js";
import { Notification } from "../models/Notification.js";
import { sendPushNotification } from "../services/pushService.js";

export const createBooking = async (req, res, next) => {
  try {
    const { rideId, seatsBooked } = req.body;
    const seats = Number(seatsBooked);

    if (!rideId || !seats || seats < 1) {
      return res.status(400).json({ message: "rideId and valid seatsBooked are required" });
    }

    const ride = await Ride.findOneAndUpdate(
      { _id: rideId, availableSeats: { $gte: seats }, status: { $in: ["pending", "ongoing"] } },
      { $inc: { availableSeats: -seats } },
      { new: true }
    );

    if (!ride) {
      return res.status(400).json({ message: "Not enough available seats" });
    }

    const booking = await Booking.create({
      user: req.user._id,
      ride: ride._id,
      seatsBooked: seats,
      totalPrice: seats * ride.pricePerSeat,
      status: "booked",
    });

    await Notification.create({
      user: ride.driver,
      type: "ride_booked",
      title: "Ride booked",
      body: `${req.user.name} booked ${seats} seat(s) from ${ride.fromCity} to ${ride.toCity}`,
      data: { rideId: ride._id, bookingId: booking._id },
    });

    const populatedRide = await Ride.findById(ride._id).populate("driver", "name fcmToken");

    await sendPushNotification({
      token: populatedRide?.driver?.fcmToken,
      title: "Your ride was booked",
      body: `${req.user.name} booked ${seats} seat(s)`,
      data: { rideId: String(ride._id), bookingId: String(booking._id) },
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("ride")
      .populate("user", "name email phone role rating isVerified");

    return res.status(201).json(populatedBooking);
  } catch (error) {
    return next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate({
        path: "ride",
        populate: {
          path: "driver",
          select: "name email phone role rating isVerified",
        },
      })
      .sort({ createdAt: -1 });

    return res.json(bookings);
  } catch (error) {
    return next(error);
  }
};
