import { Router } from "express";
import { login, me } from "./auth.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", asyncHandler(login));
router.get("/me", requireAdmin, asyncHandler(me));

export default router;
