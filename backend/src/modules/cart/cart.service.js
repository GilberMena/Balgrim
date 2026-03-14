import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/app-error.js";

async function findOrCreateCart(sessionId, userId = null) {
  let cart = await prisma.cart.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ sessionId }, { userId: userId || undefined }],
    },
    include: {
      items: {
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        sessionId,
        userId,
      },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  return cart;
}

export async function getCart(sessionId, userId = null) {
  return findOrCreateCart(sessionId, userId);
}

export async function addCartItem(sessionId, payload, userId = null) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: payload.productVariantId },
  });

  if (!variant) {
    throw new AppError("Variant not found.", 404);
  }

  const cart = await findOrCreateCart(sessionId, userId);

  await prisma.cartItem.upsert({
    where: {
      cartId_productVariantId: {
        cartId: cart.id,
        productVariantId: payload.productVariantId,
      },
    },
    update: {
      quantity: {
        increment: payload.quantity,
      },
    },
    create: {
      cartId: cart.id,
      productVariantId: payload.productVariantId,
      quantity: payload.quantity,
    },
  });

  return getCart(sessionId, userId);
}

export async function updateCartItem(itemId, payload) {
  return prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity: payload.quantity },
  });
}

export async function removeCartItem(itemId) {
  await prisma.cartItem.delete({
    where: { id: itemId },
  });
}
