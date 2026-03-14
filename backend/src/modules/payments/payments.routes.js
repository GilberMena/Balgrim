import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  addiCheckout,
  mercadopagoCheckout,
  wompiCheckout,
  wompiWebhook,
} from "./payments.controller.js";

const router = Router();

router.post("/wompi/checkout", asyncHandler(wompiCheckout));
router.post("/mercadopago/checkout", asyncHandler(mercadopagoCheckout));
router.post("/addi/checkout", asyncHandler(addiCheckout));
router.post("/wompi/webhook", asyncHandler(wompiWebhook));

export default router;
