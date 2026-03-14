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
    },
  });
}

export async function updateStoreSettings(payload) {
  return prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      storeName: payload.storeName,
      whatsappNumber: payload.whatsappNumber,
    },
    create: {
      id: SETTINGS_ID,
      storeName: payload.storeName,
      whatsappNumber: payload.whatsappNumber,
    },
  });
}
