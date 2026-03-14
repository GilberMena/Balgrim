import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { createOrder, getOrderStatus, getOrders, lookupOrderStatus } from "./orders.controller.js";
import { requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/", asyncHandler(createOrder));
router.post("/lookup", asyncHandler(lookupOrderStatus));
router.get("/:id", asyncHandler(getOrderStatus));
router.get("/", requireAdmin, asyncHandler(getOrders));

export default router;
