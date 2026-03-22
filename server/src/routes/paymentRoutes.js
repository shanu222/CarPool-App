import { Router } from "express";
import { getMyPayments, getPaymentSettingsPublic, submitPaymentProof } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";
import { paymentUpload } from "../middleware/paymentUpload.js";

const router = Router();

router.get("/settings", getPaymentSettingsPublic);
router.get("/my", protect, getMyPayments);
router.post("/create", protect, paymentUpload.single("proof"), submitPaymentProof);
router.post("/proof", protect, paymentUpload.single("proof"), submitPaymentProof);

export default router;
