import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

export async function createOrderFromCart(sessionId, payload, userId = null) {
  const cart = await prisma.cart.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ sessionId }, { userId: userId || undefined }],
    },
    include: {
      items: {
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!cart || !cart.items.length) {
    throw new AppError("Cart is empty.", 400);
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + Number(item.productVariant.price) * item.quantity,
    0
  );

  const order = await prisma.order.create({
    data: {
      userId,
      guestName: payload.guestName,
      guestEmail: payload.guestEmail || null,
      guestPhone: payload.guestPhone,
      guestAddress: payload.guestAddress,
      guestCity: payload.guestCity,
      notes: payload.notes || null,
      subtotal,
      total: subtotal,
      status: "AWAITING_PAYMENT",
      items: {
        create: cart.items.map((item) => ({
          productVariantId: item.productVariantId,
          productName: item.productVariant.product.name,
          variantLabel: `${item.productVariant.size} / ${item.productVariant.color}`,
          quantity: item.quantity,
          unitPrice: item.productVariant.price,
          totalPrice: Number(item.productVariant.price) * item.quantity,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  await prisma.cart.update({
    where: { id: cart.id },
    data: { status: "CONVERTED" },
  });

  return order;
}

export async function listOrders() {
  return prisma.order.findMany({
    include: {
      items: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLegacyOrder(payload, userId = null) {
  const shippingAmount = Number(payload.shippingAmount || 0);
  const subtotal = Number(payload.subtotal || 0);
  const total = Number(payload.total || subtotal + shippingAmount);
  const paymentMethod = payload.paymentMethod || "WHATSAPP";
  const awaitingOnlinePayment = ["WOMPI", "MERCADOPAGO", "ADDI"].includes(paymentMethod);

  const order = await prisma.order.create({
    data: {
      userId,
      guestName: payload.customer.name,
      guestEmail: payload.customer.email || null,
      guestPhone: payload.customer.phone,
      guestAddress: payload.customer.address,
      guestCity: payload.customer.city || "Pendiente",
      notes: payload.customer.notes || null,
      subtotal,
      shippingAmount,
      total,
      status: awaitingOnlinePayment ? "AWAITING_PAYMENT" : "PENDING",
      items: {
        create: payload.items.map((item) => ({
          productVariantId: item.variantId || null,
          productName: item.name,
          variantLabel: item.variantLabel || "Legacy item",
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  return order;
}
