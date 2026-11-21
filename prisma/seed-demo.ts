import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { seedSystemData } from "../src/services/onboarding";
import { publicToken } from "../src/lib/utils";

type DemoItem = { name: string; price: number; station: string; veg?: boolean };
type Demo = {
  slug: string;
  name: string;
  city: string;
  ownerEmail: string;
  ownerName: string;
  password: string;
  stations: string[];
  categories: Array<{ name: string; items: DemoItem[] }>;
};

const demos: Demo[] = [
  {
    slug: "dinedesk-pizza-demo",
    name: "DineDesk Pizza Demo",
    city: "Islamabad",
    ownerEmail: "owner@pizzademo.test",
    ownerName: "Pizza Demo Owner",
    password: "pizza123",
    stations: ["Pizza", "Drinks"],
    categories: [
      {
        name: "Pizzas",
        items: [
          { name: "Margherita Pizza", price: 899, station: "Pizza", veg: true },
          { name: "Pepperoni Pizza", price: 1099, station: "Pizza" },
        ],
      },
      {
        name: "Drinks",
        items: [{ name: "Fresh Lemonade", price: 249, station: "Drinks", veg: true }],
      },
    ],
  },
  {
    slug: "dinedesk-cafe-demo",
    name: "DineDesk Cafe Demo",
    city: "Lahore",
    ownerEmail: "owner@cafedemo.test",
    ownerName: "Cafe Demo Owner",
    password: "cafe123",
    stations: ["Coffee", "Bakery"],
    categories: [
      {
        name: "Coffee",
        items: [
          { name: "Cappuccino", price: 399, station: "Coffee", veg: true },
          { name: "Iced Latte", price: 449, station: "Coffee", veg: true },
        ],
      },
      {
        name: "Bakery",
        items: [{ name: "Chocolate Brownie", price: 349, station: "Bakery", veg: true }],
      },
    ],
  },
];

async function ensureMembership(userId: string, restaurantId: string, branchId: string | null, roleId: string) {
  const existing = await prisma.restaurantMembership.findFirst({ where: { userId, restaurantId, branchId } });
  if (existing) {
    await prisma.restaurantMembership.update({ where: { id: existing.id }, data: { roleId, isActive: true } });
    return;
  }
  await prisma.restaurantMembership.create({ data: { userId, restaurantId, branchId, roleId } });
}

async function ensureUser(email: string, name: string, passwordHash: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash } });
    return existing;
  }
  return prisma.user.create({ data: { email, name, passwordHash } });
}

async function seedDemo(demo: Demo) {
  const existing = await prisma.restaurant.findUnique({ where: { slug: demo.slug } });
  if (existing) {
    console.log(`SKIP ${demo.slug}: already exists`);
    return;
  }

  const passwordHash = await bcrypt.hash(demo.password, 10);
  const owner = await ensureUser(demo.ownerEmail, demo.ownerName, passwordHash);
  const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { code: "PRO" } });
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 10);

  const restaurant = await prisma.restaurant.create({
    data: {
      slug: demo.slug,
      name: demo.name,
      email: demo.ownerEmail,
      city: demo.city,
      currency: "PKR",
      ownerId: owner.id,
      taxRateBps: 500,
      serviceChargeBps: 300,
    },
  });

  await prisma.restaurantSettings.create({
    data: {
      restaurantId: restaurant.id,
      paymentProviders: [],
      openingHours: { mon: "10:00-23:00", tue: "10:00-23:00", wed: "10:00-23:00" },
      receiptFooter: "Thank you for dining with us!",
      allowGroupOrdering: true,
      allowIndividualOrdering: true,
    },
  });

  const branch = await prisma.branch.create({
    data: { restaurantId: restaurant.id, name: "Main Branch", code: "MAIN", openingHours: {} },
  });

  const ownerRole = await prisma.role.findFirstOrThrow({ where: { restaurantId: null, code: "OWNER" } });
  await ensureMembership(owner.id, restaurant.id, null, ownerRole.id);

  await prisma.subscription.create({
    data: { restaurantId: restaurant.id, planId: plan.id, status: "TRIALING", currentPeriodEnd: periodEnd },
  });

  const stations: Record<string, string> = {};
  for (const [index, stationName] of demo.stations.entries()) {
    const station = await prisma.kitchenStation.create({
      data: {
        restaurantId: restaurant.id,
        name: stationName,
        code: stationName.toUpperCase(),
        color: index === 0 ? "#f97316" : "#22c55e",
      },
    });
    stations[stationName] = station.id;
  }

  const tables = [];
  for (let number = 1; number <= 3; number += 1) {
    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        number: String(number),
        seats: 4,
        section: number === 3 ? "VIP" : "Main Hall",
        posX: number * 120,
        posY: 40,
      },
    });
    const token = publicToken();
    await prisma.qRCode.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        tableId: table.id,
        token,
        url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/q/${token}`,
      },
    });
    tables.push(table);
  }

  let sortOrder = 0;
  const menuItems: Array<{ id: string; name: string; priceCents: number; stationId: string | null }> = [];
  for (const category of demo.categories) {
    const categoryRecord = await prisma.menuCategory.create({
      data: { restaurantId: restaurant.id, name: category.name, sortOrder: sortOrder++, isActive: true },
    });
    for (const rawItem of category.items) {
      const item = await prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: categoryRecord.id,
          stationId: stations[rawItem.station] ?? null,
          name: rawItem.name,
          description: `${rawItem.name} prepared fresh.`,
          priceCents: rawItem.price,
          isVegetarian: rawItem.veg ?? false,
          dietaryTags: rawItem.veg ? ["Vegetarian"] : [],
          isPopular: true,
          preparationMinutes: 10,
          sortOrder: sortOrder++,
        },
      });
      await prisma.itemVariation.createMany({
        data: [
          { restaurantId: restaurant.id, menuItemId: item.id, name: "Regular", priceAdjustment: 0, sortOrder: 0 },
          { restaurantId: restaurant.id, menuItemId: item.id, name: "Large", priceAdjustment: 200, sortOrder: 1 },
        ],
      });
      await prisma.itemAddon.createMany({
        data: [
          { restaurantId: restaurant.id, menuItemId: item.id, name: "Extra Cheese", priceCents: 120, sortOrder: 0 },
          { restaurantId: restaurant.id, menuItemId: item.id, name: "Extra Sauce", priceCents: 60, sortOrder: 1 },
        ],
      });
      menuItems.push({ id: item.id, name: item.name, priceCents: item.priceCents, stationId: item.stationId });
    }
  }

  for (const roleCode of ["MANAGER", "WAITER", "KITCHEN", "CASHIER"]) {
    const email = `${roleCode.toLowerCase()}@${demo.slug}.test`;
    const staff = await ensureUser(email, `${roleCode[0]}${roleCode.slice(1).toLowerCase()} ${demo.name}`, passwordHash);
    const role = await prisma.role.findFirstOrThrow({ where: { restaurantId: null, code: roleCode } });
    await ensureMembership(staff.id, restaurant.id, branch.id, role.id);
  }

  for (const [index, table] of tables.entries()) {
    const session = await prisma.tableSession.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        tableId: table.id,
        status: index === 0 ? "OPEN" : "CLOSED",
        guestCount: 2,
      },
    });
    await prisma.restaurantTable.update({
      where: { id: table.id },
      data: { status: index === 0 ? "WAITING_FOR_FOOD" : "AVAILABLE", activeSessionId: index === 0 ? session.id : null },
    });
    const guest = await prisma.guestSession.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        tableSessionId: session.id,
        token: publicToken(),
        displayName: `Demo Guest ${index + 1}`,
      },
    });
    const item = menuItems[index % menuItems.length];
    const subtotalCents = item.priceCents;
    const taxCents = Math.round(subtotalCents * 0.05);
    const serviceCents = Math.round(subtotalCents * 0.03);
    const order = await prisma.order.create({
      data: {
        orderNumber: index + 1,
        restaurantId: restaurant.id,
        branchId: branch.id,
        tableId: table.id,
        tableSessionId: session.id,
        guestSessionId: guest.id,
        status: index === 0 ? "PREPARING" : "COMPLETED",
        source: "QR",
        customerName: guest.displayName,
        subtotalCents,
        taxCents,
        serviceCents,
        totalCents: subtotalCents + taxCents + serviceCents,
        idempotencyKey: `demo-${demo.slug}-order-${index + 1}`,
        createdAt: new Date(Date.now() - (index + 1) * 3600000),
        acceptedAt: new Date(Date.now() - index * 3600000),
        items: {
          create: [
            {
              restaurantId: restaurant.id,
              menuItemId: item.id,
              stationId: item.stationId,
              name: item.name,
              quantity: 1,
              unitPriceCents: item.priceCents,
              totalCents: item.priceCents,
              addons: [],
              status: index === 0 ? "PREPARING" : "SERVED",
            },
          ],
        },
      },
    });
    await prisma.bill.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        tableSessionId: session.id,
        token: publicToken(),
        totalCents: order.totalCents,
        status: index === 0 ? "OPEN" : "PAID",
        paidCents: index === 0 ? 0 : order.totalCents,
      },
    });
    await prisma.auditLog.create({
      data: {
        restaurantId: restaurant.id,
        action: "DEMO_ORDER_CREATED",
        entityType: "Order",
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber },
      },
    });
  }

  await prisma.notification.create({
    data: {
      restaurantId: restaurant.id,
      type: "NEW_RESTAURANT",
      title: "Demo restaurant ready",
      message: `${demo.name} is ready for testing.`,
      data: { restaurantId: restaurant.id },
    },
  });

  console.log(`CREATED ${demo.slug} (owner: ${demo.ownerEmail}, password: ${demo.password})`);
}

async function main() {
  await seedSystemData();
  for (const demo of demos) await seedDemo(demo);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
