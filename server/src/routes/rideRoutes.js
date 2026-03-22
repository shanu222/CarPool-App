import { Router } from "express";
import { createRide, getMyRides, getRideById, searchRides, updateRideStatus } from "../controllers/rideController.js";
import { protect, requireDriver, requirePassenger } from "../middleware/auth.js";

const router = Router();

router.post("/create", protect, requireDriver, createRide);
router.get("/search", protect, requirePassenger, searchRides);
router.get("/my", protect, requireDriver, getMyRides);
router.patch("/:id/status", protect, requireDriver, updateRideStatus);
router.get("/:id", getRideById);

export default router;
