import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/session";
import { publicToken, parseJson } from "@/lib/utils";
import { signRealtimeToken } from "../../realtime-token.mjs";

export async function resolveQrSession(qrToken: string, requestedMode?: "INDIVIDUAL" | "GROUP", displayName?: string) {
  const qr = await prisma.qRCode.findUnique({
    where: { token: qrToken },
    include: {
      restaurant: { include: { settings: true } },
      branch: true,
      table: true,
    },
  });
  if (!qr || !qr.table.isActive || !qr.branch.isActive || !qr.restaurant.isActive) {
    throw new HttpError(404, "This QR code is not valid");
  }

  const settings = qr.restaurant.settings;
  const allowIndividual = settings?.allowIndividualOrdering ?? true;
  const allowGroup = settings?.allowGroupOrdering ?? true;
  let mode = requestedMode ?? settings?.defaultOrderMode ?? "INDIVIDUAL";
  if (mode === "GROUP" && !allowGroup) mode = "INDIVIDUAL";
  if (mode === "INDIVIDUAL" && !allowIndividual) mode = "GROUP";

  return prisma.$transaction(async (tx) => {
    let session = await tx.tableSession.findFirst({
      where: { tableId: qr.tableId, status: { in: ["OPEN", "BILL_REQUESTED", "PARTIALLY_PAID"] } },
      orderBy: { openedAt: "desc" },
    });
    if (!session) {
      session = await tx.tableSession.create({
        data: {
          restaurantId: qr.restaurantId,
          branchId: qr.branchId,
          tableId: qr.tableId,
          groupOrdering: mode === "GROUP",
        },
      });
      await tx.restaurantTable.update({
        where: { id: qr.tableId },
        data: { status: "OCCUPIED", activeSessionId: session.id },
      });
    } else if (mode === "GROUP" && !session.groupOrdering) {
      session = await tx.tableSession.update({ where: { id: session.id }, data: { groupOrdering: true } });
    }

    let groupToken: string | null = null;
    if (mode === "GROUP") {
      let group = await tx.orderGroup.findFirst({ where: { tableSessionId: session.id, status: "OPEN" } });
      if (!group) {
        group = await tx.orderGroup.create({
          data: { restaurantId: qr.restaurantId, tableSessionId: session.id },
        });
      }
      const existingGroupGuest = await tx.guestSession.findFirst({
        where: { tableSessionId: session.id, groupToken: { not: null }, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      groupToken = existingGroupGuest?.groupToken ?? publicToken();
    }

    const guest = await tx.guestSession.create({
      data: {
        restaurantId: qr.restaurantId,
        branchId: qr.branchId,
        tableSessionId: session.id,
        token: publicToken(),
        groupToken,
        mode,
        displayName: displayName?.trim() || null,
      },
    });

    await tx.tableSession.update({
      where: { id: session.id },
      data: { guestCount: { increment: 1 } },
    });

    return {
      restaurant: {
        id: qr.restaurant.id,
        name: qr.restaurant.name,
        logoUrl: qr.restaurant.logoUrl,
        coverUrl: qr.restaurant.coverUrl,
        currency: qr.restaurant.currency,
        taxRateBps: qr.restaurant.taxRateBps,
        serviceChargeBps: qr.restaurant.serviceChargeBps,
      },
      branch: { id: qr.branch.id, name: qr.branch.name },
      table: { id: qr.table.id, number: qr.table.number, label: qr.table.label, seats: qr.table.seats },
      session: { id: session.id, status: session.status, groupOrdering: session.groupOrdering },
      guest: { id: guest.id, token: guest.token, mode: guest.mode, groupToken: guest.groupToken, displayName: guest.displayName },
      settings: {
        requireCustomerName: settings?.requireCustomerName ?? false,
        autoAcceptOrders: settings?.autoAcceptOrders ?? false,
        soundAlerts: settings?.soundAlerts ?? true,
        onlinePaymentsEnabled: settings?.onlinePaymentsEnabled ?? false,
        allowIndividualOrdering: allowIndividual,
        allowGroupOrdering: allowGroup,
      },
      realtimeToken: signRealtimeToken({
        scope: "guest",
        restaurantId: qr.restaurantId,
        branchId: qr.branchId,
        guestId: guest.id,
        tableSessionId: session.id,
      }),
    };
  });
}

export async function getGuestByToken(token: string) {
  const guest = await prisma.guestSession.findUnique({
    where: { token },
    include: { tableSession: true, restaurant: { include: { settings: true } } },
  });
  if (!guest || !guest.isActive) throw new HttpError(401, "Guest session expired. Please scan the QR code again.");
  return guest;
}

export async function getPublicMenu(restaurantId: string, branchId: string) {
  const categories = await prisma.menuCategory.findMany({
    where: {
      restaurantId,
      isActive: true,
      OR: [{ branchId: null }, { branchId }],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          variations: { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
          addons: { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
          station: { select: { id: true, name: true } },
        },
      },
    },
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    imageUrl: category.imageUrl,
    items: category.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      priceCents: item.priceCents,
      isVegetarian: item.isVegetarian,
      dietaryTags: parseJson<string[]>(item.dietaryTags, []),
      isPopular: item.isPopular,
      preparationMinutes: item.preparationMinutes,
      station: item.station,
      variations: item.variations.map((variation) => ({
        id: variation.id,
        name: variation.name,
        priceAdjustment: variation.priceAdjustment,
      })),
      addons: item.addons.map((addon) => ({ id: addon.id, name: addon.name, priceCents: addon.priceCents })),
    })),
  }));
}
