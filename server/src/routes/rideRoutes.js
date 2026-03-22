import { Router } from "express";
import { createRide, getMyRides, getRideById, searchRides, updateRideStatus } from "../controllers/rideController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/create", protect, requireRole("driver"), createRide);
router.get("/search", searchRides);
router.get("/my", protect, requireRole("driver"), getMyRides);
router.patch("/:id/status", protect, requireRole("driver"), updateRideStatus);
router.get("/:id", getRideById);

export default router;
