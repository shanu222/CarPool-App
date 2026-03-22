import { Booking } from "../models/Booking.js";
import { Ride } from "../models/Ride.js";
import { createUserNotification } from "../services/notificationService.js";

const notifyUser = async ({ userId, type = "message", title, body, data }) =>
  createUserNotification({ userId, type, title, body, data, pushFallback: true });

const maskCnic = (cnic) => {
  if (!cnic || cnic.length < 4) {
    return "****";
  }

  return `${"*".repeat(Math.max(0, cnic.length - 4))}${cnic.slice(-4)}`;
};

const sanitizeDriverForBooking = (booking, includeSensitive) => {
  const plain = booking.toObject ? booking.toObject() : booking;

  if (!plain?.ride?.driver) {
    return plain;
  }

  const driver = plain.ride.driver;
  driver.email = undefined;
  driver.phone = undefined;
  driver.cnicNumber = undefined;
  driver.cnic = undefined;
  driver.cnicPhoto = undefined;
  driver.licensePhoto = undefined;

  if (!includeSensitive) {
    driver.profilePhoto = undefined;
  }

  return plain;
};

export const createBooking = async (req, res, next) => {
  try {
    const { rideId, seatsRequested, seatsBooked } = req.body;
    const seats = Number(seatsRequested ?? seatsBooked);

    if (!req.user?.canBookRide) {
      return res.status(403).json({ message: "Booking is locked. Submit payment proof to unlock booking and chat." });
    }

    if (!rideId || !seats || seats < 1) {
      return res.status(400).json({ message: "rideId and valid seatsRequested are required" });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (String(ride.driver) === String(req.user._id)) {
      return res.status(400).json({ message: "Driver cannot book own ride" });
    }

    if (!["scheduled", "ongoing"].includes(ride.status)) {
      return res.status(400).json({ message: "This ride is not accepting booking requests" });
    }

    if (ride.availableSeats < seats) {
      return res.status(400).json({ message: "Not enough available seats" });
    }

    const existing = await Booking.findOne({
      rideId: ride._id,
      passengerId: req.user._id,
      status: { $in: ["pending", "accepted", "ongoing"] },
    });

    if (existing) {
      return res.status(409).json({ message: "You already have an active booking request for this ride" });
    }

    const booking = await Booking.create({
      passengerId: req.user._id,
      rideId: ride._id,
      user: req.user._id,
      ride: ride._id,
      seatsRequested: seats,
      seatsBooked: seats,
      totalPrice: seats * ride.pricePerSeat,
      status: "pending",
    });

    await notifyUser({
      userId: ride.driver,
      type: "ride_request",
      title: "New booking request",
      body: `${req.user.name} requested ${seats} seat(s) from ${ride.fromCity} to ${ride.toCity}`,
      data: { rideId: ride._id, bookingId: booking._id },
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate({
        path: "ride",
        populate: {
          path: "driver",
          select: "name role rating isVerified profilePhoto",
        },
      })
      .populate("passengerId", "name role rating isVerified");

    return res.status(201).json(sanitizeDriverForBooking(populatedBooking, false));
  } catch (error) {
    return next(error);
  }
};

export const respondToBookingRequest = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!["accepted", "rejected"].includes(action)) {
      return res.status(400).json({ message: "action must be accepted or rejected" });
    }

    const booking = await Booking.findById(req.params.bookingId)
      .populate("rideId")
      .populate("passengerId", "name");

    if (!booking || !booking.rideId) {
      return res.status(404).json({ message: "Booking request not found" });
    }

    if (String(booking.rideId.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only ride driver can respond to requests" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be updated" });
    }

    if (action === "accepted") {
      const updatedRide = await Ride.findOneAndUpdate(
        {
          _id: booking.rideId._id,
          availableSeats: { $gte: booking.seatsRequested },
          status: { $in: ["scheduled", "ongoing"] },
        },
        { $inc: { availableSeats: -booking.seatsRequested } },
        { new: true }
      );

      if (!updatedRide) {
        return res.status(400).json({ message: "Not enough available seats or ride is closed" });
      }

      booking.status = "accepted";
      await booking.save();
    } else {
      booking.status = "rejected";
      await booking.save();
    }

    await notifyUser({
      userId: booking.passengerId._id,
      type: "ride_request",
      title: action === "accepted" ? "Booking request accepted" : "Booking request rejected",
      body:
        action === "accepted"
          ? `${req.user.name} accepted your booking request`
          : `${req.user.name} rejected your booking request`,
      data: { rideId: booking.rideId._id, bookingId: booking._id, status: booking.status },
    });

    const populated = await Booking.findById(booking._id)
      .populate({
        path: "ride",
        populate: {
          path: "driver",
          select: "name role rating isVerified profilePhoto",
        },
      })
      .populate("passengerId", "name role rating isVerified");

    return res.json(sanitizeDriverForBooking(populated, action === "accepted"));
  } catch (error) {
    return next(error);
  }
};

export const getDriverBookingRequests = async (req, res, next) => {
  try {
    const driverRides = await Ride.find({ driver: req.user._id }).select("_id");
    const rideIds = driverRides.map((ride) => ride._id);

    const requests = await Booking.find({
      $or: [{ rideId: { $in: rideIds } }, { ride: { $in: rideIds } }],
      status: { $in: ["pending", "accepted", "rejected"] },
    })
      .populate({
        path: "ride",
        populate: {
          path: "driver",
          select: "name role rating isVerified profilePhoto",
        },
      })
      .populate("passengerId", "name role rating isVerified")
      .sort({ createdAt: -1 });

    return res.json(requests.map((booking) => sanitizeDriverForBooking(booking, true)));
  } catch (error) {
    return next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ $or: [{ passengerId: req.user._id }, { user: req.user._id }] })
      .populate({
        path: "ride",
        populate: {
          path: "driver",
          select: "name role rating isVerified profilePhoto",
        },
      })
      .sort({ createdAt: -1 });

    const sanitized = bookings.map((booking) =>
      sanitizeDriverForBooking(
        booking,
        ["accepted", "ongoing", "completed"].includes(booking.status)
      )
    );

    return res.json(sanitized);
  } catch (error) {
    return next(error);
  }
};
