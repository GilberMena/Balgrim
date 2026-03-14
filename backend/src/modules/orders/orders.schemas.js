import { z } from "zod";

export const createOrderSchema = z.object({
  guestName: z.string().min(2),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestPhone: z.string().min(7),
  guestAddress: z.string().min(5),
  guestCity: z.string().min(2),
  notes: z.string().optional(),
});

export const legacyOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(7),
    address: z.string().min(5),
    notes: z.string().optional(),
  }),
  items: z.array(
    z.object({
      id: z.string(),
      variantId: z.string().optional().nullable(),
      name: z.string(),
      variantLabel: z.string().optional(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })
  ),
  subtotal: z.number().positive(),
  source: z.string().optional(),
});
