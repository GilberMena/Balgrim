import { z } from "zod";
import { getStoreSettings, updateStoreSettings } from "./settings.service.js";

const shippingRuleSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(2),
  department: z.string().optional().default(""),
  city: z.string().optional().default(""),
  price: z.coerce.number().min(0),
  eta: z.string().optional().default(""),
});

const settingsSchema = z.object({
  storeName: z.string().min(2),
  whatsappNumber: z.string().min(7),
  shippingFlatRate: z.coerce.number().min(0).optional(),
  freeShippingFrom: z.coerce.number().min(0).optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  shippingRules: z.array(shippingRuleSchema).optional(),
});

export async function getSettings(req, res) {
  const settings = await getStoreSettings();
  res.json({ settings });
}

export async function putSettings(req, res) {
  const payload = settingsSchema.parse(req.body);
  const settings = await updateStoreSettings(payload);
  res.json({ settings });
}
