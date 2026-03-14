import { prisma } from "../../lib/prisma.js";

export async function listActiveContentBlocks() {
  return prisma.contentBlock.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
}
