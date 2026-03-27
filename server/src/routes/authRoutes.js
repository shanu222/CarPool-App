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
import { upload } from "../middleware/upload.js";

const router = Router();

router.post(
	"/register",
	upload.fields([
		{ name: "cnicFrontImage", maxCount: 1 },
		{ name: "cnicBackImage", maxCount: 1 },
		{ name: "selfieImage", maxCount: 1 },
	]),
	register
);
router.post("/login", login);
router.post("/admin/login", adminLogin);
router.post("/forgot-password", forgotPassword);
router.post("/forgot-password/resend-otp", resendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
router.post("/change-password", protect, changePassword);
router.post("/logout-all", protect, logoutAllDevices);

export default router;
