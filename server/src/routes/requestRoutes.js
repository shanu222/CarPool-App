import { Router } from "express";
import {
  acceptRideRequest,
  createRideRequest,
  getNearbyRideRequests,
  getRideRequestById,
} from "../controllers/requestController.js";
import { protect, requireDriver, requirePassenger } from "../middleware/auth.js";

const router = Router();

router.post("/create", protect, requirePassenger, createRideRequest);
router.get("/nearby", protect, requireDriver, getNearbyRideRequests);
router.get("/:requestId", protect, getRideRequestById);
router.post("/:requestId/accept", protect, requireDriver, acceptRideRequest);

export default router;
