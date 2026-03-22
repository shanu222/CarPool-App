import { Router } from "express";
import { createBooking, getMyBookings } from "../controllers/bookingController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/create", protect, requireRole("passenger"), createBooking);
router.get("/my", protect, getMyBookings);

export default router;
