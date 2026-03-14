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
