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
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().min(7),
    address: z.string().min(5),
    city: z.string().min(2).optional().or(z.literal("")),
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
  shippingOption: z.string().optional(),
  shippingAmount: z.number().min(0).optional(),
  total: z.number().positive().optional(),
  paymentMethod: z.enum(["WHATSAPP", "WOMPI", "MERCADOPAGO", "ADDI"]).optional(),
  source: z.string().optional(),
});
