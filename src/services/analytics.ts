import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/utils";

export async function getAnalytics(restaurantId: string, options: { from?: Date; to?: Date; branchId?: string | null } = {}) {
  const from = options.from ?? startOfDay();
  const to = options.to ?? endOfDay();
  const branchFilter = options.branchId ? { branchId: options.branchId } : {};

  const [orders, payments, tables, allOrdersForAvg] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, createdAt: { gte: from, lte: to }, ...branchFilter },
      include: { items: { include: { menuItem: { include: { category: true } } } }, table: true },
    }),
    prisma.payment.findMany({
      where: { restaurantId, createdAt: { gte: from, lte: to }, status: "SUCCEEDED", ...branchFilter },
    }),
    prisma.restaurantTable.findMany({
      where: { restaurantId, ...(options.branchId ? { branchId: options.branchId } : {}) },
      select: { status: true },
    }),
    prisma.order.aggregate({
      where: { restaurantId, status: { not: "CANCELLED" }, ...branchFilter },
      _avg: { totalCents: true },
      _count: true,
    }),
  ]);

  const activeOrders = orders.filter((order) => order.status !== "CANCELLED");
  const totalSalesCents = activeOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const collectedCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const itemMap = new Map<string, { name: string; quantity: number; revenueCents: number }>();
  const categoryMap = new Map<string, { name: string; revenueCents: number; quantity: number }>();
  const branchMap = new Map<string, { name: string; revenueCents: number; orders: number }>();
  const stationMap = new Map<string, { name: string; totalMinutes: number; count: number }>();

  for (const order of activeOrders) {
    for (const item of order.items) {
      const itemEntry = itemMap.get(item.menuItemId) ?? { name: item.name, quantity: 0, revenueCents: 0 };
      itemEntry.quantity += item.quantity;
      itemEntry.revenueCents += item.totalCents;
      itemMap.set(item.menuItemId, itemEntry);

      const category = item.menuItem.category.name;
      const categoryEntry = categoryMap.get(category) ?? { name: category, revenueCents: 0, quantity: 0 };
      categoryEntry.revenueCents += item.totalCents;
      categoryEntry.quantity += item.quantity;
      categoryMap.set(category, categoryEntry);

      if (item.stationId && order.readyAt) {
        const stationEntry = stationMap.get(item.stationId) ?? { name: "Kitchen", totalMinutes: 0, count: 0 };
        stationEntry.totalMinutes += Math.max(0, (order.readyAt.getTime() - order.createdAt.getTime()) / 60000);
        stationEntry.count += 1;
        stationMap.set(item.stationId, stationEntry);
      }
    }
    const branchKey = order.branchId;
    const branchEntry = branchMap.get(branchKey) ?? { name: "Branch", revenueCents: 0, orders: 0 };
    branchEntry.revenueCents += order.totalCents;
    branchEntry.orders += 1;
    branchMap.set(branchKey, branchEntry);
  }

  const paymentMethods = new Map<string, { method: string; amountCents: number; count: number }>();
  for (const payment of payments) {
    const entry = paymentMethods.get(payment.method) ?? { method: payment.method, amountCents: 0, count: 0 };
    entry.amountCents += payment.amountCents;
    entry.count += 1;
    paymentMethods.set(payment.method, entry);
  }

  const occupancy = new Map<string, number>();
  for (const table of tables) occupancy.set(table.status, (occupancy.get(table.status) ?? 0) + 1);

  const staffLogs = await prisma.auditLog.findMany({
    where: {
      restaurantId,
      createdAt: { gte: from, lte: to },
      action: { in: ["ORDER_STATUS_CHANGED", "MANUAL_ORDER_CREATED", "PAYMENT_RECORDED"] },
    },
    include: { user: { select: { name: true } } },
  });
  const staffMap = new Map<string, { name: string; actions: number }>();
  for (const log of staffLogs) {
    const key = log.userId ?? "system";
    const entry = staffMap.get(key) ?? { name: log.user?.name ?? "System", actions: 0 };
    entry.actions += 1;
    staffMap.set(key, entry);
  }

  return {
    range: { from, to },
    totalSalesCents,
    collectedCents,
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => ["NEW", "ACCEPTED", "PREPARING"].includes(order.status)).length,
    completedOrders: orders.filter((order) => ["COMPLETED", "SERVED"].includes(order.status)).length,
    cancelledOrders: orders.filter((order) => order.status === "CANCELLED").length,
    averageOrderValueCents: Math.round(totalSalesCents / Math.max(orders.length, 1)),
    lifetimeAverageCents: Math.round(allOrdersForAvg._avg.totalCents ?? 0),
    bestSellers: [...itemMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    salesByCategory: [...categoryMap.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    salesByBranch: [...branchMap.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    paymentMethodBreakdown: [...paymentMethods.values()],
    tableOccupancy: [...occupancy.entries()].map(([status, count]) => ({ status, count })),
    kitchenPerformance: [...stationMap.values()].map((station) => ({
      name: station.name,
      averageMinutes: Math.round(station.totalMinutes / Math.max(station.count, 1)),
      orders: station.count,
    })),
    staffPerformance: [...staffMap.values()].sort((a, b) => b.actions - a.actions).slice(0, 10),
    recentOrders: orders.slice(0, 10).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalCents: order.totalCents,
      table: order.table.number,
      createdAt: order.createdAt,
    })),
  };
}

export async function getSuperAdminAnalytics() {
  const [restaurants, subscriptions, payments, users, orders] = await Promise.all([
    prisma.restaurant.findMany({ select: { id: true, name: true, isActive: true, createdAt: true } }),
    prisma.subscription.findMany({ include: { plan: true, restaurant: { select: { name: true } } } }),
    prisma.platformPayment.findMany({ where: { status: "SUCCEEDED" } }),
    prisma.user.count(),
    prisma.order.count(),
  ]);
  const now = Date.now();
  const activeRestaurantIds = new Set(
    subscriptions
      .filter((subscription) =>
        ["TRIALING", "ACTIVE"].includes(subscription.status) && subscription.currentPeriodEnd.getTime() > now,
      )
      .map((subscription) => subscription.restaurantId),
  );
  const revenueByPlan = new Map<string, number>();
  for (const payment of payments) {
    const subscription = subscriptions.find((item) => item.id === payment.subscriptionId);
    const key = subscription?.plan.name ?? "Unknown";
    revenueByPlan.set(key, (revenueByPlan.get(key) ?? 0) + payment.amountCents);
  }
  return {
    totalRestaurants: restaurants.length,
    activeRestaurants: restaurants.filter((item) => item.isActive && activeRestaurantIds.has(item.id)).length,
    suspendedRestaurants: restaurants.filter((item) => !item.isActive || !activeRestaurantIds.has(item.id)).length,
    totalUsers: users,
    totalOrders: orders,
    platformRevenueCents: payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    revenueByPlan: [...revenueByPlan.entries()].map(([plan, amountCents]) => ({ plan, amountCents })),
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      restaurant: subscription.restaurant.name,
      plan: subscription.plan.name,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    })),
  };
}
