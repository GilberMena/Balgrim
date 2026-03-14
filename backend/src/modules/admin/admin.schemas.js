import { z } from "zod";

export const adminVariantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(2),
  size: z.string().min(1),
  color: z.string().min(1),
  stock: z.coerce.number().int().min(0),
  price: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().nonnegative().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

export const adminProductSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional().default(""),
  active: z.coerce.boolean().default(true),
  featured: z.coerce.boolean().default(false),
  images: z.array(z.string().url()).default([]),
  variants: z.array(adminVariantSchema).min(1),
});

export const adminOrderUpdateSchema = z.object({
  status: z.enum([
    "PENDING",
    "AWAITING_PAYMENT",
    "PAID",
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
  ]),
  internalNotes: z.string().optional().default(""),
});

export const inventoryAdjustmentSchema = z.object({
  productVariantId: z.string().min(1),
  quantityChange: z.coerce.number().int().refine((value) => value !== 0),
  reason: z.string().min(3),
});

export const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(3),
  description: z.string().optional().default(""),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().nonnegative().optional().nullable(),
  active: z.coerce.boolean().default(true),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
});

export const contentBlockSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(2),
  title: z.string().min(2),
  body: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
  actionLabel: z.string().optional().default(""),
  actionHref: z.string().optional().default(""),
  active: z.coerce.boolean().default(true),
  position: z.coerce.number().int().min(0).default(0),
});
