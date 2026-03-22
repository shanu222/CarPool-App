import { Router } from "express";
import { getMyChangeRequests, submitChangeRequest } from "../controllers/changeRequestController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.post("/", submitChangeRequest);
router.get("/my", getMyChangeRequests);

export default router;
