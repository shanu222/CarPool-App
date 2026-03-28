import { Router } from "express";
import { createRide, getMyRides, getNearbyRides, getRideById, searchRides, updateRideStatus } from "../controllers/rideController.js";
import { protect, requireDriver } from "../middleware/auth.js";
import { checkPostAccess, requireDriverForPost } from "../middleware/tokenAccessMiddleware.js";

const router = Router();

router.post("/create", protect, requireDriverForPost, checkPostAccess, createRide);
router.get("/nearby", protect, getNearbyRides);
router.get("/search", protect, searchRides);
router.get("/my", protect, requireDriver, getMyRides);
router.patch("/:id/status", protect, requireDriver, updateRideStatus);
router.get("/:id", getRideById);

export default router;
