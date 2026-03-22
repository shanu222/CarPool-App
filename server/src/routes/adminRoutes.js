import { Router } from "express";
import {
  approvePaymentByAdmin,
  deleteRideByAdmin,
  featureRideByAdmin,
  getAdminAnalytics,
  getAdminPayments,
  getAdminRides,
  getAdminUsers,
  getPaymentSettingsAdmin,
  updatePaymentSettingsAdmin,
  updateUserStatusByAdmin,
  verifyUserByAdmin,
} from "../controllers/adminController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(protect, requireAdmin);

router.get("/users", getAdminUsers);
router.post("/verify-user", verifyUserByAdmin);
router.post("/verify", verifyUserByAdmin);
router.post("/user-status", updateUserStatusByAdmin);

router.get("/rides", getAdminRides);
router.delete("/rides/:rideId", deleteRideByAdmin);
router.post("/feature-ride", featureRideByAdmin);

router.get("/payments", getAdminPayments);
router.post("/approve-payment", approvePaymentByAdmin);
router.post("/payment/approve", approvePaymentByAdmin);

router.get("/payment-settings", getPaymentSettingsAdmin);
router.post("/payment-settings", updatePaymentSettingsAdmin);

router.get("/analytics", getAdminAnalytics);

export default router;
