import { prisma } from "../../lib/prisma.js";

export async function listProducts() {
  return prisma.product.findMany({
    where: { active: true },
    include: {
      category: true,
      images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductBySlug(slug) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
      variants: true,
    },
  });
}
