import { Router } from "express";
import { getLatestRideLocation, getRideLocationHistory } from "../controllers/locationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/latest/:rideId", protect, getLatestRideLocation);
router.get("/history/:rideId", protect, getRideLocationHistory);

export default router;
