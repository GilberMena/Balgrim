import { createOrderSchema, legacyOrderSchema } from "./orders.schemas.js";
import {
  createLegacyOrder,
  createOrderFromCart,
  getOrderById,
  listOrders,
} from "./orders.service.js";

export async function createOrder(req, res) {
  let order;

  if (req.body?.customer && req.body?.items) {
    const payload = legacyOrderSchema.parse(req.body);
    order = await createLegacyOrder(payload, req.user?.id);
  } else {
    const sessionId = req.cookies?.balgrim_session_id;
    const payload = createOrderSchema.parse(req.body);
    order = await createOrderFromCart(sessionId, payload, req.user?.id);
  }

  res.status(201).json({ order });
}

export async function getOrders(req, res) {
  const orders = await listOrders();
  res.json({ orders });
}

export async function getOrderStatus(req, res) {
  const order = await getOrderById(req.params.id);
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  const phone = String(req.query.phone || "").replace(/\D/g, "");
  const orderPhone = String(order.guestPhone || "").replace(/\D/g, "");
  if (phone && orderPhone && phone !== orderPhone) {
    res.status(403).json({ error: "Phone does not match this order." });
    return;
  }

  res.json({
    order: {
      ...order,
      subtotal: Number(order.subtotal),
      shippingAmount: Number(order.shippingAmount),
      total: Number(order.total),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      payments: order.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    },
  });
}

export async function lookupOrderStatus(req, res) {
  const orderId = String(req.body?.orderId || "").trim();
  const phone = String(req.body?.phone || "").replace(/\D/g, "");

  if (!orderId || !phone) {
    res.status(400).json({ error: "orderId and phone are required." });
    return;
  }

  req.params.id = orderId;
  req.query.phone = phone;
  return getOrderStatus(req, res);
}
