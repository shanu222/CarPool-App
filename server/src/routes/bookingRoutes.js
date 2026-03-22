import { Router } from "express";
import {
	createBooking,
	getDriverBookingRequests,
	getMyBookings,
	respondToBookingRequest,
} from "../controllers/bookingController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/create", protect, requireRole("passenger"), createBooking);
router.get("/my", protect, getMyBookings);
router.get("/driver-requests", protect, requireRole("driver"), getDriverBookingRequests);
router.patch("/:bookingId/respond", protect, requireRole("driver"), respondToBookingRequest);

export default router;
