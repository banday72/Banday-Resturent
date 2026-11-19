import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/session";
import { bps, parseJson, publicToken } from "@/lib/utils";
import { emitToGuest, emitToRestaurant, emitToTableSession } from "@/lib/realtime";
import { getCartView, getCartForGuest } from "@/services/cart";
import { recalculateBill } from "@/services/billing";
import type { GuestSession } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function placeOrder(input: {
  guestToken: string;
  idempotencyKey: string;
  customerName?: string | null;
  source?: string;
}) {
  const guest = await prisma.guestSession.findUnique({
    where: { token: input.guestToken },
    include: { restaurant: { include: { settings: true } }, tableSession: true },
  });
  if (!guest || !guest.isActive) throw new HttpError(401, "Guest session expired. Please scan the QR code again.");
  if (guest.tableSession.status === "PAID" || guest.tableSession.status === "CLOSED") {
    throw new HttpError(409, "This table session has already been closed");
  }

  const duplicate = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (duplicate) return duplicate;

  const cartView = await getCartView(guest);
  if (cartView.items.length === 0) throw new HttpError(400, "Your cart is empty");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { order: existing, created: false };

    const lastOrder = await tx.order.findFirst({
      where: { restaurantId: guest.restaurantId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;
    const subtotalCents = cartView.subtotalCents;
    const taxCents = bps(subtotalCents, guest.restaurant.taxRateBps);
    const serviceCents = bps(subtotalCents, guest.restaurant.serviceChargeBps);
    const autoAccept = (guest.restaurant.settings as { autoAcceptOrders?: boolean } | null)?.autoAcceptOrders ?? false;

    const order = await tx.order.create({
      data: {
        orderNumber,
        restaurantId: guest.restaurantId,
        branchId: guest.branchId,
        tableId: guest.tableSession.tableId,
        tableSessionId: guest.tableSessionId,
        guestSessionId: guest.mode === "INDIVIDUAL" ? guest.id : null,
        orderGroupId: guest.mode === "GROUP" ? (await getActiveGroupId(tx, guest)) : null,
        source: input.source ?? "QR",
        customerName: input.customerName?.trim() || guest.displayName || null,
        subtotalCents,
        taxCents,
        serviceCents,
        totalCents: subtotalCents + taxCents + serviceCents,
        idempotencyKey: input.idempotencyKey,
        status: autoAccept ? "ACCEPTED" : "NEW",
        acceptedAt: autoAccept ? new Date() : null,
      },
    });

    for (const item of cartView.items) {
      const menuItem = await tx.menuItem.findUniqueOrThrow({ where: { id: item.menuItemId } });
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          restaurantId: guest.restaurantId,
          menuItemId: item.menuItemId,
          stationId: menuItem.stationId,
          name: item.name,
          variationName: item.variationName,
          addons: item.addonNames,
          instructions: item.instructions,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          addonsCents: item.addonsCents,
          totalCents: item.lineTotalCents,
        },
      });
    }

    const cart = await getCartForGuest(guest);
    if (cart) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { status: "SUBMITTED" } });
    }

    await tx.tableSession.update({
      where: { id: guest.tableSessionId },
      data: { status: "OPEN" },
    });
    await tx.restaurantTable.update({
      where: { id: guest.tableSession.tableId },
      data: { status: "WAITING_FOR_FOOD" },
    });

    await recalculateBill(tx, guest.tableSessionId);

    await tx.notification.create({
      data: {
        restaurantId: guest.restaurantId,
        orderId: order.id,
        type: "NEW_ORDER",
        title: `New order #${order.orderNumber}`,
        message: `Table ${await tableNumber(tx, guest.tableSession.tableId)} placed a new order.`,
        data: { orderId: order.id, tableSessionId: guest.tableSessionId, source: order.source },
      },
    });
    await tx.auditLog.create({
      data: {
        restaurantId: guest.restaurantId,
        action: "ORDER_PLACED",
        entityType: "Order",
        entityId: order.id,
        orderId: order.id,
        metadata: { orderNumber, totalCents: order.totalCents, source: order.source },
      },
    });
    return { order, created: true };
  });

  const fullOrder = await prisma.order.findUniqueOrThrow({
    where: { id: result.order.id },
    include: { items: true, table: true, tableSession: true },
  });
  const payload = serializeOrder(fullOrder);
  emitToRestaurant(guest.restaurantId, "order:created", payload);
  emitToGuest(guest.id, "order:created", payload);
  emitToTableSession(guest.tableSessionId, "order:created", payload);
  return payload;
}

async function getActiveGroupId(tx: Tx, guest: GuestSession) {
  if (guest.mode !== "GROUP") return null;
  const group = await tx.orderGroup.findFirst({
    where: { tableSessionId: guest.tableSessionId, status: "OPEN" },
  });
  return group?.id ?? null;
}

async function tableNumber(tx: Tx, tableId: string) {
  const table = await tx.restaurantTable.findUniqueOrThrow({ where: { id: tableId } });
  return table.number;
}

export function serializeOrder(order: {
  id: string;
  orderNumber: number;
  restaurantId: string;
  branchId: string;
  tableId: string;
  tableSessionId: string;
  guestSessionId: string | null;
  orderGroupId: string | null;
  status: string;
  source: string;
  customerName: string | null;
  subtotalCents: number;
  taxCents: number;
  serviceCents: number;
  discountCents: number;
  totalCents: number;
  createdAt: Date;
  acceptedAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  servedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  items: Array<{
    id: string;
    name: string;
    variationName: string | null;
    addons: unknown;
    instructions: string | null;
    quantity: number;
    unitPriceCents: number;
    addonsCents: number;
    totalCents: number;
    status: string;
    stationId: string | null;
  }>;
  table?: { number: string } | null;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    restaurantId: order.restaurantId,
    branchId: order.branchId,
    tableId: order.tableId,
    tableName: order.table?.number ?? null,
    tableSessionId: order.tableSessionId,
    guestSessionId: order.guestSessionId,
    orderGroupId: order.orderGroupId,
    status: order.status,
    source: order.source,
    customerName: order.customerName,
    subtotalCents: order.subtotalCents,
    taxCents: order.taxCents,
    serviceCents: order.serviceCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    servedAt: order.servedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      variationName: item.variationName,
      addons: parseJson<string[]>(item.addons, []),
      instructions: item.instructions,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      addonsCents: item.addonsCents,
      totalCents: item.totalCents,
      status: item.status,
      stationId: item.stationId,
    })),
  };
}

export async function getOrdersForRestaurant(restaurantId: string, options: { branchId?: string | null; status?: string | null; tableSessionId?: string | null; limit?: number } = {}) {
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      ...(options.branchId ? { branchId: options.branchId } : {}),
      ...(options.status ? { status: options.status as never } : {}),
      ...(options.tableSessionId ? { tableSessionId: options.tableSessionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 200,
    include: { items: true, table: true, guestSession: { select: { displayName: true, mode: true } } },
  });
  return orders.map((order) => ({
    ...serializeOrder(order),
    guestName: order.guestSession?.displayName ?? null,
    mode: order.guestSession?.mode ?? null,
  }));
}

export async function getKitchenOrders(restaurantId: string, stationId?: string | null) {
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] },
      ...(stationId ? { items: { some: { stationId } } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { items: true, table: true },
  });
  return orders
    .map((order) => {
      const items = stationId ? order.items.filter((item) => item.stationId === stationId) : order.items;
      return serializeOrder({ ...order, items });
    })
    .filter((order) => order.items.length > 0);
}

const allowedTransitions: Record<string, string[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(input: {
  orderId: string;
  restaurantId: string;
  status: string;
  actorId?: string | null;
  reason?: string | null;
}) {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, restaurantId: input.restaurantId },
    include: { items: true, tableSession: true },
  });
  if (!order) throw new HttpError(404, "Order not found");
  const allowed = allowedTransitions[order.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw new HttpError(409, `Cannot change order from ${order.status} to ${input.status}`);
  }

  const now = new Date();
  const updateData: Prisma.OrderUpdateInput = { status: input.status as never };
  if (input.status === "ACCEPTED") updateData.acceptedAt = now;
  if (input.status === "PREPARING") updateData.preparingAt = now;
  if (input.status === "READY") updateData.readyAt = now;
  if (input.status === "SERVED") updateData.servedAt = now;
  if (input.status === "COMPLETED") updateData.completedAt = now;
  if (input.status === "CANCELLED") {
    updateData.cancelledAt = now;
    updateData.cancelledReason = input.reason ?? null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: order.id }, data: updateData });
    const itemStatus = input.status === "CANCELLED" ? "CANCELLED" : input.status === "PREPARING" ? "PREPARING" : input.status === "READY" ? "READY" : input.status === "SERVED" ? "SERVED" : null;
    if (itemStatus) {
      await tx.orderItem.updateMany({
        where: { orderId: order.id, status: { not: "CANCELLED" } },
        data: { status: itemStatus as never },
      });
    }
    await recalculateBill(tx, order.tableSessionId);

    if (input.status === "READY" || input.status === "SERVED") {
      const tableId = order.tableId;
      const otherActive = await tx.order.count({
        where: { tableSessionId: order.tableSessionId, status: { in: ["NEW", "ACCEPTED", "PREPARING"] } },
      });
      if (input.status === "READY") {
        await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "FOOD_READY" } });
      } else if (otherActive === 0) {
        await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
      }
    }
    if (input.status === "CANCELLED") {
      await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: "OCCUPIED" } });
    }

    await tx.notification.create({
      data: {
        restaurantId: input.restaurantId,
        orderId: order.id,
        type: input.status === "READY" ? "ORDER_READY" : "ORDER_STATUS",
        title: `Order #${order.orderNumber} ${input.status.toLowerCase()}`,
        message: `Order #${order.orderNumber} is now ${input.status.toLowerCase()}.`,
        data: { orderId: order.id, status: input.status },
      },
    });
    await tx.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        userId: input.actorId ?? null,
        action: "ORDER_STATUS_CHANGED",
        entityType: "Order",
        entityId: order.id,
        orderId: order.id,
        metadata: { from: order.status, to: input.status, reason: input.reason ?? null },
      },
    });
    return updated;
  });

  const full = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, table: true } });
  const payload = serializeOrder(full);
  emitToRestaurant(input.restaurantId, "order:status", payload);
  emitToTableSession(order.tableSessionId, "order:status", payload);
  if (order.guestSessionId) emitToGuest(order.guestSessionId, "order:status", payload);
  return payload;
}

export async function createManualOrder(input: {
  restaurantId: string;
  branchId: string;
  tableSessionId: string;
  items: Array<{ menuItemId: string; quantity: number; variationId?: string | null; instructions?: string | null }>;
  actorId: string;
  customerName?: string | null;
}) {
  const session = await prisma.tableSession.findFirst({
    where: { id: input.tableSessionId, restaurantId: input.restaurantId },
  });
  if (!session) throw new HttpError(404, "Table session not found");
  if (input.items.length === 0) throw new HttpError(400, "No items selected");

  const result = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.findUniqueOrThrow({ where: { id: input.restaurantId } });
    const lastOrder = await tx.order.findFirst({
      where: { restaurantId: input.restaurantId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    let subtotalCents = 0;
    const prepared: Array<{
      menuItemId: string;
      stationId: string | null;
      name: string;
      variationName: string | null;
      quantity: number;
      unitPriceCents: number;
      addonsCents: number;
      totalCents: number;
      instructions: string | null;
    }> = [];
    for (const entry of input.items) {
      const menuItem = await tx.menuItem.findFirst({
        where: { id: entry.menuItemId, restaurantId: input.restaurantId },
        include: { variations: true },
      });
      if (!menuItem) throw new HttpError(404, "Menu item not found");
      const variation = entry.variationId ? menuItem.variations.find((item) => item.id === entry.variationId) : null;
      const unitPriceCents = menuItem.priceCents + (variation?.priceAdjustment ?? 0);
      const quantity = Math.max(1, Math.trunc(entry.quantity));
      const totalCents = unitPriceCents * quantity;
      subtotalCents += totalCents;
      prepared.push({
        menuItemId: menuItem.id,
        stationId: menuItem.stationId,
        name: menuItem.name,
        variationName: variation?.name ?? null,
        quantity,
        unitPriceCents,
        addonsCents: 0,
        totalCents,
        instructions: entry.instructions ?? null,
      });
    }
    const taxCents = bps(subtotalCents, restaurant.taxRateBps);
    const serviceCents = bps(subtotalCents, restaurant.serviceChargeBps);
    const order = await tx.order.create({
      data: {
        orderNumber: (lastOrder?.orderNumber ?? 0) + 1,
        restaurantId: input.restaurantId,
        branchId: input.branchId,
        tableId: session.tableId,
        tableSessionId: session.id,
        source: "WAITER",
        customerName: input.customerName ?? null,
        status: "ACCEPTED",
        acceptedAt: new Date(),
        subtotalCents,
        taxCents,
        serviceCents,
        totalCents: subtotalCents + taxCents + serviceCents,
        idempotencyKey: publicToken(),
      },
    });
    for (const item of prepared) {
      await tx.orderItem.create({ data: { orderId: order.id, restaurantId: input.restaurantId, ...item, addons: [] } });
    }
    await tx.tableSession.update({ where: { id: session.id }, data: { status: "OPEN" } });
    await tx.restaurantTable.update({ where: { id: session.tableId }, data: { status: "WAITING_FOR_FOOD" } });
    await recalculateBill(tx, session.id);
    await tx.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        userId: input.actorId,
        action: "MANUAL_ORDER_CREATED",
        entityType: "Order",
        entityId: order.id,
        orderId: order.id,
        metadata: { totalCents: order.totalCents },
      },
    });
    return order.id;
  });

  const full = await prisma.order.findUniqueOrThrow({ where: { id: result }, include: { items: true, table: true } });
  const payload = serializeOrder(full);
  emitToRestaurant(input.restaurantId, "order:created", payload);
  emitToTableSession(session.id, "order:created", payload);
  return payload;
}

export async function transferTableSession(input: {
  restaurantId: string;
  tableSessionId: string;
  newTableId: string;
  actorId: string;
}) {
  const session = await prisma.tableSession.findFirst({
    where: { id: input.tableSessionId, restaurantId: input.restaurantId },
  });
  if (!session) throw new HttpError(404, "Table session not found");
  const newTable = await prisma.restaurantTable.findFirst({
    where: { id: input.newTableId, restaurantId: input.restaurantId, isActive: true },
  });
  if (!newTable) throw new HttpError(404, "Target table not found");
  if (newTable.id === session.tableId) throw new HttpError(400, "Choose a different table");

  const result = await prisma.$transaction(async (tx) => {
    await tx.tableSession.update({
      where: { id: session.id },
      data: { tableId: newTable.id, branchId: newTable.branchId },
    });
    await tx.order.updateMany({
      where: { tableSessionId: session.id },
      data: { tableId: newTable.id, branchId: newTable.branchId },
    });
    const bill = await tx.bill.findUnique({ where: { tableSessionId: session.id } });
    if (bill) await tx.bill.update({ where: { id: bill.id }, data: { branchId: newTable.branchId } });
    await tx.restaurantTable.update({ where: { id: session.tableId }, data: { status: "AVAILABLE", activeSessionId: null } });
    await tx.restaurantTable.update({ where: { id: newTable.id }, data: { status: session.status === "BILL_REQUESTED" ? "BILL_REQUESTED" : "OCCUPIED", activeSessionId: session.id } });
    await tx.auditLog.create({
      data: {
        restaurantId: input.restaurantId,
        userId: input.actorId,
        action: "TABLE_TRANSFERRED",
        entityType: "TableSession",
        entityId: session.id,
        metadata: { fromTableId: session.tableId, toTableId: newTable.id },
      },
    });
    return { sessionId: session.id, fromTableId: session.tableId, toTableId: newTable.id };
  });
  emitToRestaurant(input.restaurantId, "table:updated", result);
  emitToTableSession(session.id, "table:updated", result);
  return result;
}
