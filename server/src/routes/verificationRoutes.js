import { Router } from "express";
import { listVerificationRequests, submitVerification, verifyUser } from "../controllers/verificationController.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.post(
  "/submit",
  protect,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "cnicPhoto", maxCount: 1 },
    { name: "licensePhoto", maxCount: 1 },
    { name: "carPhoto", maxCount: 1 },
  ]),
  submitVerification
);
router.get("/requests", protect, requireAdmin, listVerificationRequests);
router.patch("/verify/:userId", protect, requireAdmin, verifyUser);

export default router;
