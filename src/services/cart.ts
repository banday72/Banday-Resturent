import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/session";
import { parseJson } from "@/lib/utils";
import type { GuestSession } from "@prisma/client";

type AddItemInput = {
  menuItemId: string;
  variationId?: string | null;
  addonIds?: string[];
  quantity?: number;
  instructions?: string | null;
};

export async function getCartForGuest(guest: GuestSession, create = true) {
  const key = guest.mode === "GROUP" && guest.groupToken
    ? `group:${guest.groupToken}`
    : `guest:${guest.id}`;

  const existing = await prisma.cart.findFirst({ where: { key, status: "ACTIVE" } });
  if (existing) return existing;
  if (!create) return null;

  let orderGroupId: string | null = null;
  if (guest.mode === "GROUP" && guest.groupToken) {
    const group = await prisma.orderGroup.findFirst({
      where: { tableSessionId: guest.tableSessionId, status: "OPEN" },
    });
    if (group) orderGroupId = group.id;
  }

  return prisma.cart.create({
    data: {
      restaurantId: guest.restaurantId,
      branchId: guest.branchId,
      tableSessionId: guest.tableSessionId,
      guestSessionId: guest.mode === "INDIVIDUAL" ? guest.id : null,
      orderGroupId,
      key,
      status: "ACTIVE",
    },
  });
}

export async function addToCart(guest: GuestSession, input: AddItemInput) {
  const cart = await getCartForGuest(guest);
  if (!cart) throw new HttpError(500, "Failed to initialize cart");
  const item = await prisma.menuItem.findFirst({
    where: { id: input.menuItemId, restaurantId: guest.restaurantId, isAvailable: true },
    include: { addons: true, variations: true },
  });
  if (!item) throw new HttpError(404, "Menu item is not available");

  const variation = input.variationId
    ? item.variations.find((candidate) => candidate.id === input.variationId && candidate.isAvailable)
    : null;
  if (input.variationId && !variation) throw new HttpError(400, "Invalid variation");

  const addonIds = Array.from(new Set(input.addonIds ?? []));
  const addons = addonIds.map((id) => {
    const addon = item.addons.find((candidate) => candidate.id === id && candidate.isAvailable);
    if (!addon) throw new HttpError(400, "Invalid add-on");
    return addon;
  });

  const quantity = Math.min(Math.max(Math.trunc(input.quantity ?? 1), 1), 50);
  const unitPriceCents = item.priceCents + (variation?.priceAdjustment ?? 0);
  const addonsCents = addons.reduce((sum, addon) => sum + addon.priceCents, 0);

  return prisma.cartItem.create({
    data: {
      cartId: cart.id,
      menuItemId: item.id,
      variationId: variation?.id ?? null,
      addonIds,
      quantity,
      unitPriceCents,
      addonsCents,
      instructions: input.instructions?.trim() || null,
    },
  });
}

export async function updateCartItem(guest: GuestSession, itemId: string, quantity: number) {
  const cart = await getCartForGuest(guest, false);
  if (!cart) throw new HttpError(404, "Cart is empty");
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
  if (!item) throw new HttpError(404, "Cart item not found");
  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return null;
  }
  return prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: Math.min(Math.trunc(quantity), 50) },
  });
}

export async function removeCartItem(guest: GuestSession, itemId: string) {
  const cart = await getCartForGuest(guest, false);
  if (!cart) throw new HttpError(404, "Cart is empty");
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
}

export async function clearCart(guest: GuestSession) {
  const cart = await getCartForGuest(guest, false);
  if (cart) await prisma.cart.update({ where: { id: cart.id }, data: { status: "ABANDONED" } });
}

export async function getCartView(guest: GuestSession) {
  const cart = await getCartForGuest(guest, false);
  if (!cart) return { items: [], subtotalCents: 0, count: 0, mode: guest.mode };
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: "asc" },
    include: {
      menuItem: { include: { addons: true } },
      variation: true,
    },
  });
  const view = items.map((item) => {
    const addonIds = parseJson<string[]>(item.addonIds, []);
    const addonNames = item.menuItem.addons
      .filter((addon) => addonIds.includes(addon.id))
      .map((addon) => addon.name);
    return {
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      imageUrl: item.menuItem.imageUrl,
      variationId: item.variationId,
      variationName: item.variation?.name ?? null,
      addonIds,
      addonNames,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      addonsCents: item.addonsCents,
      instructions: item.instructions,
      lineTotalCents: (item.unitPriceCents + item.addonsCents) * item.quantity,
    };
  });
  return {
    items: view,
    subtotalCents: view.reduce((sum, item) => sum + item.lineTotalCents, 0),
    count: view.reduce((sum, item) => sum + item.quantity, 0),
    mode: guest.mode,
  };
}
