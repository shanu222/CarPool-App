import { Router } from "express";
import {
	adminLogin,
	changePassword,
	forgotPassword,
	login,
	logoutAllDevices,
	register,
	resendForgotPasswordOtp,
	resetPassword,
	verifyResetOtp,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/admin/login", adminLogin);
router.post("/forgot-password", forgotPassword);
router.post("/forgot-password/resend-otp", resendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
router.post("/change-password", protect, changePassword);
router.post("/logout-all", protect, logoutAllDevices);

export default router;
