import { Router } from "express";
import { getMyPayments, getPaymentSettingsPublic, submitPaymentProof } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/settings", getPaymentSettingsPublic);
router.get("/my", protect, getMyPayments);
router.post(
  "/submit",
  protect,
  upload.fields([{ name: "screenshot", maxCount: 1 }]),
  submitPaymentProof
);

export default router;
