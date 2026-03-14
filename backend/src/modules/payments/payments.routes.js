import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { wompiCheckout, wompiWebhook } from "./payments.controller.js";

const router = Router();

router.post("/wompi/checkout", asyncHandler(wompiCheckout));
router.post("/wompi/webhook", asyncHandler(wompiWebhook));

export default router;
