import { prisma } from "../../lib/prisma.js";

const SETTINGS_ID = "balgrim-store-settings";

export async function getStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      storeName: "Balgrim",
      whatsappNumber: "573000000000",
      shippingRules: [],
    },
  });
}

export async function updateStoreSettings(payload) {
  return prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      storeName: payload.storeName,
      whatsappNumber: payload.whatsappNumber,
      shippingFlatRate: payload.shippingFlatRate ?? undefined,
      freeShippingFrom: payload.freeShippingFrom ?? undefined,
      shippingRules: payload.shippingRules ?? undefined,
      supportEmail: payload.supportEmail || null,
    },
    create: {
      id: SETTINGS_ID,
      storeName: payload.storeName,
      whatsappNumber: payload.whatsappNumber,
      shippingFlatRate: payload.shippingFlatRate ?? 0,
      freeShippingFrom: payload.freeShippingFrom ?? 0,
      shippingRules: payload.shippingRules ?? [],
      supportEmail: payload.supportEmail || null,
    },
  });
}
