import { Router } from "express";
import {
  acceptRideRequest,
  createRideRequest,
  getMyRideRequests,
  getNearbyRideRequests,
  getRideRequestById,
} from "../controllers/requestController.js";
import { protect, requireDriver, requirePassenger } from "../middleware/auth.js";
import { checkRequestAccess, requirePassengerForRequest } from "../middleware/tokenAccessMiddleware.js";

const router = Router();

router.post("/create", protect, requirePassengerForRequest, checkRequestAccess, createRideRequest);
router.get("/my", protect, requirePassenger, getMyRideRequests);
router.get("/nearby", protect, requireDriver, getNearbyRideRequests);
router.get("/:requestId", protect, getRideRequestById);
router.post("/:requestId/accept", protect, requireDriver, acceptRideRequest);

export default router;
