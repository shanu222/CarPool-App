import { Router } from "express";
import {
	createBooking,
	getDriverBookingRequests,
	getMyBookings,
	respondToBookingRequest,
} from "../controllers/bookingController.js";
import { protect, requireDriver, requirePassenger } from "../middleware/auth.js";

const router = Router();

router.post("/create", protect, requirePassenger, createBooking);
router.get("/my", protect, requirePassenger, getMyBookings);
router.get("/driver-requests", protect, requireDriver, getDriverBookingRequests);
router.patch("/:bookingId/respond", protect, requireDriver, respondToBookingRequest);

export default router;
