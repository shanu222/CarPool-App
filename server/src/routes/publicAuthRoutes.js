import { Router } from "express";
import { driverSignup, passengerSignup, publicLogin } from "../controllers/authController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

const signupFields = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "cnicFront", maxCount: 1 },
  { name: "cnicBack", maxCount: 1 },
  { name: "licenseImage", maxCount: 1 },
]);

router.post("/passenger/signup", signupFields, passengerSignup);
router.post("/driver/signup", signupFields, driverSignup);
router.post("/login", publicLogin);

export default router;
