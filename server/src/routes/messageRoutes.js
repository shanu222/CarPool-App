import { Router } from "express";
import { getRideMessages, markRideMessagesSeen, sendMessage, startRideChatAccess } from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/access/:rideId", protect, startRideChatAccess);
router.get("/:rideId", protect, getRideMessages);
router.get("/ride/:rideId", protect, getRideMessages);
router.patch("/:rideId/seen", protect, markRideMessagesSeen);
router.post("/", protect, sendMessage);

export default router;
