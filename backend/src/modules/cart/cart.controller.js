import crypto from "crypto";
import { addCartItemSchema, updateCartItemSchema } from "./cart.schemas.js";
import { addCartItem, getCart, removeCartItem, updateCartItem } from "./cart.service.js";

function ensureSessionId(req, res) {
  const current = req.cookies?.balgrim_session_id;
  if (current) {
    return current;
  }

  const sessionId = crypto.randomUUID();
  res.cookie("balgrim_session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  return sessionId;
}

export async function getCurrentCart(req, res) {
  const sessionId = ensureSessionId(req, res);
  const cart = await getCart(sessionId, req.user?.id);
  res.json({ cart });
}

export async function createCartItem(req, res) {
  const sessionId = ensureSessionId(req, res);
  const payload = addCartItemSchema.parse(req.body);
  const cart = await addCartItem(sessionId, payload, req.user?.id);
  res.status(201).json({ cart });
}

export async function patchCartItem(req, res) {
  const payload = updateCartItemSchema.parse(req.body);
  const item = await updateCartItem(req.params.itemId, payload);
  res.json({ item });
}

export async function deleteCartItem(req, res) {
  await removeCartItem(req.params.itemId);
  res.status(204).send();
}
