import { Router } from "express";
import { getRideMessages, sendMessage } from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/ride/:rideId", protect, getRideMessages);
router.post("/", protect, sendMessage);

export default router;
