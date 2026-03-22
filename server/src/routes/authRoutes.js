import { Router } from "express";
import {
	adminLogin,
	changePassword,
	forgotPassword,
	login,
	logoutAllDevices,
	register,
	resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/admin/login", adminLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", protect, changePassword);
router.post("/logout-all", protect, logoutAllDevices);

export default router;
