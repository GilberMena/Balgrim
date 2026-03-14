import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { createWompiCheckout, processWompiWebhook } from "./payments.service.js";

export async function wompiCheckout(req, res) {
  const { orderId } = req.body;
  if (!orderId) {
    throw new AppError("orderId is required.", 400);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  const checkout = await createWompiCheckout(order);
  res.json({ checkout });
}

export async function wompiWebhook(req, res) {
  const result = await processWompiWebhook(req.body);
  res.json(result);
}
