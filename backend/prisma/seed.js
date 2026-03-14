import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hombre = await prisma.category.upsert({
    where: { slug: "hombre" },
    update: {},
    create: { name: "Hombre", slug: "hombre" },
  });

  const mujer = await prisma.category.upsert({
    where: { slug: "mujer" },
    update: {},
    create: { name: "Mujer", slug: "mujer" },
  });

  const nuevos = await prisma.category.upsert({
    where: { slug: "nuevos-lanzamientos" },
    update: {},
    create: { name: "Nuevos lanzamientos", slug: "nuevos-lanzamientos" },
  });

  const catalog = [
    { slug: "fortitude-tee", name: "T-Shirt Fortitude", description: "Drop esencial.", categoryId: nuevos.id, price: 129000, size: "M", color: "Blanco", sku: "BAL-FT-WHT-M" },
    { slug: "special-edition-tee", name: "T-Shirt Special Edition", description: "Edicion limitada.", categoryId: nuevos.id, price: 149000, size: "M", color: "Negro", sku: "BAL-SE-BLK-M" },
    { slug: "creative-sanctuary-tee", name: "Creative Sanctuary", description: "Drop grafico insignia.", categoryId: nuevos.id, price: 139000, size: "L", color: "Negro", sku: "BAL-CS-BLK-L" },
    { slug: "black-fortitude-tee", name: "Black Fortitude Tee", description: "Algodon pesado.", categoryId: hombre.id, price: 139000, size: "M", color: "Negro", sku: "BAL-BFT-BLK-M" },
    { slug: "ivory-core-tee", name: "Ivory Core Tee", description: "Fit regular.", categoryId: hombre.id, price: 129000, size: "M", color: "Marfil", sku: "BAL-ICT-IVR-M" },
    { slug: "statement-back-print", name: "Statement Back Print", description: "Edicion grafica.", categoryId: hombre.id, price: 149000, size: "L", color: "Negro", sku: "BAL-SBP-BLK-L" },
    { slug: "signature-crop-tee", name: "Signature Crop Tee", description: "Bordado fino.", categoryId: mujer.id, price: 129000, size: "S", color: "Blanco", sku: "BAL-SCT-WHT-S" },
    { slug: "noir-essential-tee", name: "Noir Essential Tee", description: "Negro profundo.", categoryId: mujer.id, price: 139000, size: "M", color: "Negro", sku: "BAL-NET-BLK-M" },
    { slug: "sanctuary-oversize", name: "Sanctuary Oversize", description: "Espalda statement.", categoryId: mujer.id, price: 149000, size: "L", color: "Blanco", sku: "BAL-SOV-WHT-L" },
    { slug: "balgrim-cap", name: "Balgrim Cap", description: "Logo frontal.", categoryId: nuevos.id, price: 119000, size: "UNI", color: "Negro", sku: "BAL-CAP-BLK-U" },
    { slug: "minimal-backpack", name: "Minimal Backpack", description: "Utility line.", categoryId: nuevos.id, price: 249000, size: "UNI", color: "Negro", sku: "BAL-MBP-BLK-U" },
    { slug: "signature-tote", name: "Signature Tote", description: "Neutral canvas.", categoryId: nuevos.id, price: 169000, size: "UNI", color: "Crudo", sku: "BAL-TOT-CRU-U" },
  ];

  for (const item of catalog) {
    await prisma.product.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        categoryId: item.categoryId,
        variants: {
          create: [
            {
              sku: item.sku,
              size: item.size,
              color: item.color,
              stock: 10,
              price: item.price,
            },
          ],
        },
      },
    });
  }

  await prisma.storeSettings.upsert({
    where: { id: "balgrim-store-settings" },
    update: {
      storeName: "Balgrim",
      whatsappNumber: "573000000000",
      shippingFlatRate: 15000,
      freeShippingFrom: 280000,
      supportEmail: "soporte@balgrim.co",
    },
    create: {
      id: "balgrim-store-settings",
      storeName: "Balgrim",
      whatsappNumber: "573000000000",
      shippingFlatRate: 15000,
      freeShippingFrom: 280000,
      supportEmail: "soporte@balgrim.co",
    },
  });

  await prisma.coupon.upsert({
    where: { code: "BALGRIM10" },
    update: {
      description: "10% en drops seleccionados",
      discountType: "percentage",
      discountValue: 10,
      minOrderAmount: 180000,
      active: true,
    },
    create: {
      code: "BALGRIM10",
      description: "10% en drops seleccionados",
      discountType: "percentage",
      discountValue: 10,
      minOrderAmount: 180000,
      active: true,
    },
  });

  await prisma.contentBlock.upsert({
    where: { key: "home-hero" },
    update: {
      title: "Te damos la bienvenida a un mundo donde el lujo no solo se viste, se encarna.",
      body: "Balgrim trabaja drops sobrios, oscuros y con caracter editorial.",
      actionLabel: "Explorar coleccion",
      actionHref: "/nuevos-lanzamientos.html",
      position: 1,
      active: true,
    },
    create: {
      key: "home-hero",
      title: "Te damos la bienvenida a un mundo donde el lujo no solo se viste, se encarna.",
      body: "Balgrim trabaja drops sobrios, oscuros y con caracter editorial.",
      actionLabel: "Explorar coleccion",
      actionHref: "/nuevos-lanzamientos.html",
      position: 1,
      active: true,
    },
  });

  const passwordHash = await bcrypt.hash("Balgrim123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@balgrim.co" },
    update: {
      firstName: "Balgrim",
      lastName: "Admin",
      role: "ADMIN",
    },
    create: {
      email: "admin@balgrim.co",
      passwordHash,
      firstName: "Balgrim",
      lastName: "Admin",
      role: "ADMIN",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
