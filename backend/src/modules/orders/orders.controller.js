import { createOrderSchema, legacyOrderSchema } from "./orders.schemas.js";
import { createLegacyOrder, createOrderFromCart, listOrders } from "./orders.service.js";

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
