import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { getSettings, putSettings } from "./settings.controller.js";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/", asyncHandler(getSettings));
router.put("/", requireAdmin, asyncHandler(putSettings));

export default router;
