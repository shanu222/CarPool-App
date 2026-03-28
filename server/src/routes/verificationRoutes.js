import { Router } from "express";
import {
  listVerificationRequests,
  reverifySelf,
  renewCnicSelf,
  renewLicenseSelf,
  submitVerification,
  verifyUser,
} from "../controllers/verificationController.js";
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

router.post(
  "/reverify",
  protect,
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
  ]),
  reverifySelf
);

router.post(
  "/renew-cnic",
  protect,
  upload.fields([
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
  ]),
  renewCnicSelf
);

router.post(
  "/renew-license",
  protect,
  upload.fields([{ name: "licenseImage", maxCount: 1 }]),
  renewLicenseSelf
);

export default router;
