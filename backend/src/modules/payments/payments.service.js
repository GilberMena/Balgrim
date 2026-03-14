import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

export async function createWompiCheckout(order, customer = {}) {
  const amountInCents = Math.round(Number(order.total) * 100);
  const reference = `BALGRIM-${order.id}`;

  await prisma.payment.upsert({
    where: { providerRef: reference },
    update: {
      amount: order.total,
      status: "PENDING",
      rawPayload: {
        source: "wompi_checkout_request",
        customer,
      },
    },
    create: {
      orderId: order.id,
      provider: "WOMPI",
      providerRef: reference,
      amount: order.total,
      status: "PENDING",
      rawPayload: {
        source: "wompi_checkout_request",
        customer,
      },
    },
  });

  const baseCheckout = {
    provider: "WOMPI",
    orderId: order.id,
    amountInCents,
    currency: "COP",
    publicKey: env.WOMPI_PUBLIC_KEY || "",
    reference,
    available: Boolean(env.WOMPI_PUBLIC_KEY && env.WOMPI_INTEGRITY_SECRET),
  };

  if (!env.WOMPI_PUBLIC_KEY || !env.WOMPI_INTEGRITY_SECRET) {
    return {
      ...baseCheckout,
      message: "Wompi aun no esta configurado con llaves reales en el backend.",
    };
  }

  const redirectUrl = `${env.FRONTEND_URL}/checkout.html?payment=wompi&order=${encodeURIComponent(order.id)}`;
  const integrity = crypto
    .createHash("sha256")
    .update(`${reference}${amountInCents}COP${env.WOMPI_INTEGRITY_SECRET}`)
    .digest("hex");

  const params = new URLSearchParams({
    "public-key": env.WOMPI_PUBLIC_KEY,
    currency: "COP",
    "amount-in-cents": String(amountInCents),
    reference,
    "redirect-url": redirectUrl,
    "signature:integrity": integrity,
  });

  if (customer.email) params.set("customer-data:email", customer.email);
  if (customer.fullName) params.set("customer-data:full-name", customer.fullName);
  if (customer.phone) {
    params.set("customer-data:phone-number", customer.phone.replace(/\D/g, ""));
    params.set("customer-data:phone-number-prefix", "+57");
  }
  if (customer.address) params.set("shipping-address:address-line-1", customer.address);
  if (customer.city) params.set("shipping-address:city", customer.city);
  params.set("shipping-address:country", "CO");

  return {
    ...baseCheckout,
    checkoutUrl: `https://checkout.wompi.co/p/?${params.toString()}`,
    redirectUrl,
  };
}

export async function processWompiWebhook(payload) {
  const transaction = payload?.data?.transaction || payload?.transaction || null;
  const reference = transaction?.reference || null;
  const status = String(transaction?.status || "").toUpperCase();

  if (reference) {
    const paymentStatus =
      status === "APPROVED"
        ? "APPROVED"
        : status === "DECLINED"
          ? "DECLINED"
          : status === "ERROR"
            ? "ERROR"
            : "PENDING";

    const payment = await prisma.payment.updateMany({
      where: { providerRef: reference },
      data: {
        status: paymentStatus,
        rawPayload: payload,
      },
    });

    if (payment.count > 0) {
      const orderId = reference.replace(/^BALGRIM-/, "");
      await prisma.order.updateMany({
        where: { id: orderId },
        data: {
          status: paymentStatus === "APPROVED" ? "PAID" : "AWAITING_PAYMENT",
        },
      });
    }
  }

  return {
    received: true,
    payload,
  };
}
