import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { createOrder, getOrders } from "./orders.controller.js";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/", asyncHandler(createOrder));
router.get("/", requireAdmin, asyncHandler(getOrders));

export default router;
