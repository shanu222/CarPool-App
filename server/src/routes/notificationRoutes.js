import { Router } from "express";
import {
	getMyNotifications,
	getNotificationSettings,
	markNotificationRead,
	registerFcmToken,
	updateNotificationSettings,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/settings", protect, getNotificationSettings);
router.patch("/settings", protect, updateNotificationSettings);
router.get("/my", protect, getMyNotifications);
router.patch("/:id/read", protect, markNotificationRead);
router.post("/fcm-token", protect, registerFcmToken);

export default router;
