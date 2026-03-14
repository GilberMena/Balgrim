import { env } from "../../config/env.js";

export async function createWompiCheckout(order) {
  return {
    provider: "WOMPI",
    orderId: order.id,
    amountInCents: Number(order.total) * 100,
    currency: "COP",
    publicKey: env.WOMPI_PUBLIC_KEY || "",
    reference: order.id,
  };
}

export async function processWompiWebhook(payload) {
  return {
    received: true,
    payload,
  };
}
