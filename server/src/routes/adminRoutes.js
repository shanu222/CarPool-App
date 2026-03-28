import { Router } from "express";
import {
  approvePaymentByAdminId,
  approvePaymentByAdmin,
  deleteUserByAdmin,
  deleteRideByAdmin,
  featureRideByAdmin,
  getAdminAnalytics,
  getAdminBookings,
  getAdminBlockedUsers,
  getAdminChangeRequests,
  getAdminPayments,
  getAdminPaymentProof,
  getAdminReports,
  getAdminRides,
  getAdminUsers,
  getDeletedUsersByAdmin,
  reviewAdminChangeRequest,
  reviewUserReportByAdmin,
  unblockRelationByAdmin,
  unbanUserByAdmin,
  getPaymentSettingsAdmin,
  rejectPaymentByAdminId,
  updatePaymentSettingsAdmin,
  updateUserStatusByAdmin,
  verifyUserByAdmin,
} from "../controllers/adminController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(protect, requireAdmin);

router.get("/users", getAdminUsers);
router.delete("/users/:userId", deleteUserByAdmin);
router.post("/users/:userId/unban", unbanUserByAdmin);
router.post("/verify-user", verifyUserByAdmin);
router.post("/verify", verifyUserByAdmin);
router.post("/user-status", updateUserStatusByAdmin);

router.get("/rides", getAdminRides);
router.get("/bookings", getAdminBookings);
router.delete("/rides/:rideId", deleteRideByAdmin);
router.post("/feature-ride", featureRideByAdmin);

router.get("/payments", getAdminPayments);
router.get("/payments/:paymentId/proof", getAdminPaymentProof);
router.post("/approve-payment", approvePaymentByAdmin);
router.post("/payment/approve", approvePaymentByAdmin);
router.post("/approve-payment/:id", approvePaymentByAdminId);
router.post("/reject-payment/:id", rejectPaymentByAdminId);

router.get("/payment-settings", getPaymentSettingsAdmin);
router.post("/payment-settings", updatePaymentSettingsAdmin);

router.get("/analytics", getAdminAnalytics);
router.get("/deleted-users", getDeletedUsersByAdmin);
router.get("/change-requests", getAdminChangeRequests);
router.post("/change-requests/:id/review", reviewAdminChangeRequest);
router.get("/reports", getAdminReports);
router.post("/reports/:reportId/action", reviewUserReportByAdmin);
router.get("/blocked-users", getAdminBlockedUsers);
router.post("/blocked-users/:relationId/unblock", unblockRelationByAdmin);

export default router;
