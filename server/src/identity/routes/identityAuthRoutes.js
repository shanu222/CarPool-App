import { Router } from "express";
import {
  loginIdentityUser,
  resetIdentityPassword,
  signupWithIdentityVerification,
  verifyForgotPasswordIdentity,
} from "../controllers/identityAuthController.js";
import { identityUpload } from "../middleware/identityUpload.js";

const router = Router();

router.post(
  "/signup",
  identityUpload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
    { name: "licenseImage", maxCount: 1 },
  ]),
  signupWithIdentityVerification
);
router.post("/login", loginIdentityUser);
router.post("/forgot-password/verify-identity", verifyForgotPasswordIdentity);
router.post("/forgot-password/reset", resetIdentityPassword);

export default router;
