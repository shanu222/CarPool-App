import { Router } from "express";
import { getMyNotifications, markNotificationRead, registerFcmToken } from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/my", protect, getMyNotifications);
router.patch("/:id/read", protect, markNotificationRead);
router.post("/fcm-token", protect, registerFcmToken);

export default router;
