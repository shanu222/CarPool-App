import { Router } from "express";
import { acceptRideMatch, approveRideMatch, getMyMatchedTrips } from "../controllers/matchController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/my", protect, getMyMatchedTrips);
router.post("/accept", protect, acceptRideMatch);
router.post("/:matchId/approve", protect, approveRideMatch);

export default router;
