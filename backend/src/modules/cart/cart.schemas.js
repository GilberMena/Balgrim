import { z } from "zod";

export const addCartItemSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(20),
});
