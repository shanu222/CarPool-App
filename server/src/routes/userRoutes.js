import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { submitVerification } from "../controllers/verificationController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.post(
  "/upload-documents",
  protect,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "cnicPhoto", maxCount: 1 },
    { name: "licensePhoto", maxCount: 1 },
  ]),
  submitVerification
);

export default router;
