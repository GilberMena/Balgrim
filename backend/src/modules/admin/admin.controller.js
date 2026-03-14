import { prisma } from "../../lib/prisma.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  adminOrderUpdateSchema,
  adminProductSchema,
  contentBlockSchema,
  couponSchema,
  inventoryAdjustmentSchema,
} from "./admin.schemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../../uploads");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

async function writeAudit(req, action, entityType, entityId, summary, payload = null) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: req.user?.id || null,
        action,
        entityType,
        entityId,
        summary,
        payload,
      },
    });
  } catch (error) {
    console.error("audit_log_error", error);
  }
}

function getUploadFilename(url) {
  if (!url || !String(url).includes("/uploads/")) {
    return "";
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").pop() || "";
  } catch (error) {
    return String(url).split("/").pop()?.split("?")[0] || "";
  }
}

async function cleanupUploads(urls = []) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  for (const url of uniqueUrls) {
    const refs = await Promise.all([
      prisma.productImage.count({ where: { url } }),
      prisma.productVariant.count({ where: { imageUrl: url } }),
      prisma.contentBlock.count({ where: { imageUrl: url } }),
    ]);

    if (refs.some((count) => count > 0)) {
      continue;
    }

    const filename = getUploadFilename(url);
    if (!filename) {
      continue;
    }

    const filepath = path.resolve(uploadsDir, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}

function serializeProduct(product) {
  return {
    id: product.slug,
    dbId: product.id,
    name: product.name,
    category: product.category?.name || "Sin categoria",
    description: product.description || "",
    active: product.active,
    featured: product.featured,
    primaryImage: product.images.find((image) => image.isPrimary)?.url || product.images[0]?.url || "",
    images: product.images
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position)
      .map((image) => image.url),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      price: Number(variant.price),
      compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice) : null,
      imageUrl: variant.imageUrl || "",
    })),
  };
}

async function getStoreSettingsRecord() {
  return prisma.storeSettings.findFirstOrThrow();
}

export async function getDashboard(req, res) {
  const [products, orders, users, coupons, contentBlocks, lowStockVariants, recentOrders] =
    await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count(),
      prisma.coupon.count(),
      prisma.contentBlock.count(),
      prisma.productVariant.findMany({
        where: { stock: { lte: 5 } },
        include: { product: true },
        orderBy: { stock: "asc" },
        take: 8,
      }),
      prisma.order.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const revenueAgg = await prisma.order.aggregate({
    _sum: { total: true },
    where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } },
  });

  res.json({
    metrics: {
      products,
      orders,
      users,
      coupons,
      contentBlocks,
      revenue: Number(revenueAgg._sum.total || 0),
      lowStockCount: lowStockVariants.length,
    },
    lowStock: lowStockVariants.map((variant) => ({
      id: variant.id,
      productName: variant.product.name,
      sku: variant.sku,
      stock: variant.stock,
      size: variant.size,
      color: variant.color,
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      guestName: order.guestName,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
  });
}

export async function getAdminProducts(req, res) {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      images: true,
      variants: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ products: products.map(serializeProduct) });
}

export async function saveAdminProduct(req, res) {
  const payload = adminProductSchema.parse(req.body);
  const category = await prisma.category.upsert({
    where: { slug: slugify(payload.category) },
    update: { name: payload.category },
    create: { slug: slugify(payload.category), name: payload.category },
  });

  const existing = await prisma.product.findUnique({
    where: { slug: payload.id },
    include: { images: true, variants: true },
  });

  const previousUrls = [
    ...(existing?.images || []).map((image) => image.url),
    ...(existing?.variants || []).map((variant) => variant.imageUrl).filter(Boolean),
  ];

  const product = await prisma.product.upsert({
    where: { slug: payload.id },
    update: {
      name: payload.name,
      description: payload.description,
      active: payload.active,
      featured: payload.featured,
      categoryId: category.id,
    },
    create: {
      slug: payload.id,
      name: payload.name,
      description: payload.description,
      active: payload.active,
      featured: payload.featured,
      categoryId: category.id,
    },
  });

  await prisma.productImage.deleteMany({ where: { productId: product.id } });
  if (payload.images.length) {
    await prisma.productImage.createMany({
      data: payload.images.map((url, index) => ({
        productId: product.id,
        url,
        isPrimary: index === 0,
        position: index,
      })),
    });
  }

  const incomingVariantIds = payload.variants.filter((variant) => variant.id).map((variant) => variant.id);
  if (existing) {
    const variantsToDelete = existing.variants
      .filter((variant) => !incomingVariantIds.includes(variant.id))
      .map((variant) => variant.id);

    if (variantsToDelete.length) {
      await prisma.productVariant.deleteMany({
        where: { id: { in: variantsToDelete } },
      });
    }
  }

  for (const variant of payload.variants) {
    if (variant.id) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: {
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice || null,
          imageUrl: variant.imageUrl || null,
        },
      });
    } else {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice || null,
          imageUrl: variant.imageUrl || null,
        },
      });
    }
  }

  const nextUrls = [
    ...payload.images,
    ...payload.variants.map((variant) => variant.imageUrl).filter(Boolean),
  ];
  const removedUrls = previousUrls.filter((url) => !nextUrls.includes(url));
  if (removedUrls.length) {
    await cleanupUploads(removedUrls);
  }

  await writeAudit(req, existing ? "update" : "create", "product", product.id, `${payload.name} guardado`, payload);
  return getAdminProducts(req, res);
}

export async function deleteAdminProduct(req, res) {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.id },
    include: { images: true, variants: true },
  });
  if (product) {
    const removedUrls = [
      ...product.images.map((image) => image.url),
      ...product.variants.map((variant) => variant.imageUrl).filter(Boolean),
    ];
    await prisma.product.delete({ where: { id: product.id } });
    await cleanupUploads(removedUrls);
    await writeAudit(req, "delete", "product", product.id, `${product.name} eliminado`);
  }
  return getAdminProducts(req, res);
}

export async function getAdminOrders(req, res) {
  const orders = await prisma.order.findMany({
    include: {
      items: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    orders: orders.map((order) => ({
      ...order,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      shippingAmount: Number(order.shippingAmount),
      discountAmount: Number(order.discountAmount),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      payments: order.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    })),
  });
}

export async function updateAdminOrder(req, res) {
  const payload = adminOrderUpdateSchema.parse(req.body);
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status: payload.status,
      internalNotes: payload.internalNotes,
    },
  });

  await writeAudit(req, "update", "order", order.id, `Pedido ${order.id} actualizado`, payload);
  res.json({ order });
}

export async function getCustomers(req, res) {
  const customers = await prisma.user.findMany({
    include: {
      orders: true,
      addresses: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    customers: customers.map((customer) => ({
      id: customer.id,
      email: customer.email,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email,
      phone: customer.phone || "",
      role: customer.role,
      totalOrders: customer.orders.length,
      totalSpent: customer.orders.reduce((sum, order) => sum + Number(order.total), 0),
      addressCount: customer.addresses.length,
      createdAt: customer.createdAt,
    })),
  });
}

export async function getInventory(req, res) {
  const [variants, adjustments] = await Promise.all([
    prisma.productVariant.findMany({
      include: { product: true },
      orderBy: { stock: "asc" },
    }),
    prisma.inventoryAdjustment.findMany({
      include: {
        productVariant: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  res.json({
    variants: variants.map((variant) => ({
      id: variant.id,
      productName: variant.product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      price: Number(variant.price),
      lowStock: variant.stock <= 5,
    })),
    adjustments: adjustments.map((item) => ({
      id: item.id,
      productName: item.productVariant.product.name,
      sku: item.productVariant.sku,
      quantityChange: item.quantityChange,
      reason: item.reason,
      createdAt: item.createdAt,
    })),
  });
}

export async function createInventoryAdjustment(req, res) {
  const payload = inventoryAdjustmentSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    await tx.inventoryAdjustment.create({
      data: payload,
    });

    await tx.productVariant.update({
      where: { id: payload.productVariantId },
      data: {
        stock: {
          increment: payload.quantityChange,
        },
      },
    });
  });

  await writeAudit(req, "adjust", "inventory", payload.productVariantId, `Ajuste de inventario ${payload.quantityChange}`, payload);
  return getInventory(req, res);
}

export async function getCoupons(req, res) {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json({
    coupons: coupons.map((coupon) => ({
      ...coupon,
      discountValue: Number(coupon.discountValue),
      minOrderAmount: coupon.minOrderAmount ? Number(coupon.minOrderAmount) : null,
    })),
  });
}

export async function saveCoupon(req, res) {
  const payload = couponSchema.parse(req.body);
  const coupon = await prisma.coupon.upsert({
    where: { code: payload.code },
    update: {
      description: payload.description,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      minOrderAmount: payload.minOrderAmount || null,
      active: payload.active,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      usageLimit: payload.usageLimit || null,
    },
    create: {
      code: payload.code,
      description: payload.description,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      minOrderAmount: payload.minOrderAmount || null,
      active: payload.active,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      usageLimit: payload.usageLimit || null,
    },
  });

  await writeAudit(req, "upsert", "coupon", coupon.id, `Cupon ${coupon.code} guardado`, payload);
  return getCoupons(req, res);
}

export async function deleteCoupon(req, res) {
  const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (coupon) {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    await writeAudit(req, "delete", "coupon", coupon.id, `Cupon ${coupon.code} eliminado`);
  }
  return getCoupons(req, res);
}

export async function getContentBlocks(req, res) {
  const blocks = await prisma.contentBlock.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  res.json({ blocks });
}

export async function saveContentBlock(req, res) {
  const payload = contentBlockSchema.parse(req.body);
  const existing = payload.id
    ? await prisma.contentBlock.findUnique({ where: { id: payload.id } })
    : await prisma.contentBlock.findUnique({ where: { key: payload.key } });
  const block = await prisma.contentBlock.upsert({
    where: { key: payload.key },
    update: payload,
    create: payload,
  });

  if (existing?.imageUrl && existing.imageUrl !== payload.imageUrl) {
    await cleanupUploads([existing.imageUrl]);
  }

  await writeAudit(req, "upsert", "content", block.id, `Bloque ${block.key} guardado`, payload);
  return getContentBlocks(req, res);
}

export async function deleteContentBlock(req, res) {
  const block = await prisma.contentBlock.findUnique({ where: { id: req.params.id } });
  if (block) {
    await prisma.contentBlock.delete({ where: { id: req.params.id } });
    if (block.imageUrl) {
      await cleanupUploads([block.imageUrl]);
    }
    await writeAudit(req, "delete", "content", block.id, `Bloque ${block.key} eliminado`);
  }
  return getContentBlocks(req, res);
}

export async function getAuditLogs(req, res) {
  const logs = await prisma.adminAuditLog.findMany({
    include: {
      actor: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  res.json({
    logs: logs.map((log) => ({
      ...log,
      actorName:
        [log.actor?.firstName, log.actor?.lastName].filter(Boolean).join(" ") ||
        log.actor?.email ||
        "Sistema",
    })),
  });
}

export async function getStoreSettingsAdmin(req, res) {
  const settings = await getStoreSettingsRecord();
  res.json({
    settings: {
      ...settings,
      shippingFlatRate: Number(settings.shippingFlatRate),
      freeShippingFrom: Number(settings.freeShippingFrom),
    },
  });
}

export async function updateStoreSettingsAdmin(req, res) {
  const payload = req.body;
  const settings = await prisma.storeSettings.upsert({
    where: { id: payload.id || "balgrim-store-settings" },
    update: {
      storeName: payload.storeName,
      whatsappNumber: payload.whatsappNumber,
      shippingFlatRate: payload.shippingFlatRate || 0,
      freeShippingFrom: payload.freeShippingFrom || 0,
      supportEmail: payload.supportEmail || null,
    },
    create: {
      id: payload.id || "balgrim-store-settings",
      storeName: payload.storeName,
      whatsappNumber: payload.whatsappNumber,
      shippingFlatRate: payload.shippingFlatRate || 0,
      freeShippingFrom: payload.freeShippingFrom || 0,
      supportEmail: payload.supportEmail || null,
    },
  });

  await writeAudit(req, "update", "settings", settings.id, "Configuracion de tienda actualizada", payload);
  return getStoreSettingsAdmin(req, res);
}
