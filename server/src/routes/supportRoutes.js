import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { createSupportRequest } from "../controllers/supportController.js";

const router = Router();

router.post("/", protect, createSupportRequest);

export default router;
