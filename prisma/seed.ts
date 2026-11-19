import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { seedSystemData } from "../src/services/onboarding";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function ensureMembership(userId: string, restaurantId: string, branchId: string | null, roleId: string) {
  const existing = await prisma.restaurantMembership.findFirst({ where: { userId, restaurantId, branchId } });
  if (existing) {
    await prisma.restaurantMembership.update({ where: { id: existing.id }, data: { roleId, isActive: true } });
    return existing;
  }
  return prisma.restaurantMembership.create({ data: { userId, restaurantId, branchId, roleId } });
}

async function main() {
  await seedSystemData();
  const passwordHash = await bcrypt.hash("demo123", 10);
  const adminHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@restaurant.test" },
    create: { email: "admin@restaurant.test", name: "Platform Admin", passwordHash: adminHash, isSuperAdmin: true },
    update: { isSuperAdmin: true, name: "Platform Admin" },
  });

  const demoRestaurants = [
    {
      slug: "pizza-house",
      name: "Pizza House",
      email: "owner@pizzahouse.test",
      ownerName: "Ahmed Khan",
      currency: "PKR",
      city: "Islamabad",
      accent: "#f97316",
      branches: ["Islamabad", "Rawalpindi"],
      stations: ["Pizza", "Grill", "Drinks", "Dessert"],
      categories: [
        {
          name: "Pizzas",
          items: [
            { name: "Margherita Pizza", price: 899, station: "Pizza", popular: true, veg: true, desc: "Classic tomato, mozzarella and basil." },
            { name: "Pepperoni Pizza", price: 1099, station: "Pizza", popular: true, desc: "Loaded with pepperoni and mozzarella." },
            { name: "BBQ Chicken Pizza", price: 1199, station: "Pizza", stationAlt: "Grill", desc: "Smoky BBQ chicken with red onions." },
          ],
        },
        {
          name: "Grills",
          items: [
            { name: "Grilled Chicken", price: 999, station: "Grill", desc: "Char-grilled chicken with herbs." },
            { name: "Beef Burger", price: 749, station: "Grill", popular: true, desc: "Juicy beef patty with cheese and sauce." },
          ],
        },
        {
          name: "Drinks",
          items: [
            { name: "Fresh Lemonade", price: 249, station: "Drinks", veg: true, desc: "House-made lemonade with mint." },
            { name: "Iced Coffee", price: 299, station: "Drinks", veg: true, desc: "Cold brewed coffee over ice." },
          ],
        },
        {
          name: "Desserts",
          items: [{ name: "Chocolate Brownie", price: 349, station: "Dessert", veg: true, desc: "Warm brownie with chocolate sauce." }],
        },
      ],
    },
    {
      slug: "burger-lab",
      name: "Burger Lab",
      email: "owner@burgerlab.test",
      ownerName: "Sara Ali",
      currency: "PKR",
      city: "Lahore",
      accent: "#ef4444",
      branches: ["Lahore"],
      stations: ["Burger", "Fries", "Drinks"],
      categories: [
        {
          name: "Burgers",
          items: [
            { name: "Classic Cheeseburger", price: 649, station: "Burger", popular: true, desc: "Beef patty, cheddar, lettuce and house sauce." },
            { name: "Crispy Chicken Burger", price: 699, station: "Burger", popular: true, desc: "Crispy chicken fillet with slaw." },
          ],
        },
        {
          name: "Sides",
          items: [{ name: "Loaded Fries", price: 399, station: "Fries", veg: true, desc: "Fries with cheese sauce and spices." }],
        },
        {
          name: "Drinks",
          items: [{ name: "Cola", price: 199, station: "Drinks", veg: true, desc: "Chilled soft drink." }],
        },
      ],
    },
  ];

  for (const demo of demoRestaurants) {
    let owner = await prisma.user.findUnique({ where: { email: demo.email } });
    if (!owner) {
      owner = await prisma.user.create({
        data: { email: demo.email, name: demo.ownerName, passwordHash },
      });
    }

    let restaurant = await prisma.restaurant.findUnique({ where: { slug: demo.slug } });
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          slug: demo.slug,
          name: demo.name,
          email: demo.email,
          city: demo.city,
          currency: demo.currency,
          ownerId: owner.id,
          taxRateBps: 500,
          serviceChargeBps: 300,
          coverUrl: null,
        },
      });
      await prisma.restaurantSettings.create({
        data: {
          restaurantId: restaurant.id,
          paymentProviders: [],
          openingHours: { mon: "10:00-23:00", tue: "10:00-23:00", wed: "10:00-23:00", thu: "10:00-23:00", fri: "10:00-00:00", sat: "10:00-00:00", sun: "12:00-22:00" },
          receiptFooter: "Thank you for dining with us!",
          allowGroupOrdering: true,
          allowIndividualOrdering: true,
        },
      });
    }

    const ownerRole = await prisma.role.findFirstOrThrow({ where: { restaurantId: null, code: "OWNER" } });
    await ensureMembership(owner.id, restaurant.id, null, ownerRole.id);

    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { code: "PRO" } });
    const existingSubscription = await prisma.subscription.findFirst({ where: { restaurantId: restaurant.id } });
    if (!existingSubscription) {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      await prisma.subscription.create({
        data: { restaurantId: restaurant.id, planId: plan.id, status: "ACTIVE", currentPeriodEnd: periodEnd },
      });
    }

    const branchRecords = [];
    for (let index = 0; index < demo.branches.length; index += 1) {
      const branchName = demo.branches[index];
      const code = branchName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 20);
      branchRecords.push(
        await prisma.branch.upsert({
          where: { restaurantId_code: { restaurantId: restaurant.id, code } },
          create: { restaurantId: restaurant.id, name: branchName, code, openingHours: {} },
          update: { name: branchName },
        }),
      );
    }

    const stationRecords = [];
    for (const station of demo.stations) {
      stationRecords.push(
        await prisma.kitchenStation.upsert({
          where: { restaurantId_code: { restaurantId: restaurant.id, code: station.toUpperCase() } },
          create: {
            restaurantId: restaurant.id,
            name: station,
            code: station.toUpperCase(),
            color: station === "Pizza" ? "#f97316" : station === "Drinks" ? "#0ea5e9" : station === "Dessert" ? "#a855f7" : "#22c55e",
          },
          update: {},
        }),
      );
    }

    for (const [branchIndex, branch] of branchRecords.entries()) {
      for (let tableNumber = 1; tableNumber <= 5; tableNumber += 1) {
        const number = String(tableNumber + branchIndex * 10);
        const table = await prisma.restaurantTable.upsert({
          where: { branchId_number: { branchId: branch.id, number } },
          create: {
            restaurantId: restaurant.id,
            branchId: branch.id,
            number,
            seats: tableNumber % 2 === 0 ? 6 : 4,
            section: tableNumber <= 2 ? "Window" : tableNumber <= 4 ? "Main Hall" : "VIP",
            posX: (tableNumber % 3) * 180 + 40,
            posY: Math.floor((tableNumber - 1) / 3) * 150 + 40,
          },
          update: {},
        });
        const token = `${demo.slug}-${branch.code.toLowerCase()}-t${number}`;
        await prisma.qRCode.upsert({
          where: { tableId: table.id },
          create: {
            restaurantId: restaurant.id,
            branchId: branch.id,
            tableId: table.id,
            token,
            url: `${appUrl}/q/${token}`,
          },
          update: { token, url: `${appUrl}/q/${token}` },
        });
      }
    }

    let sortOrder = 0;
    for (const category of demo.categories) {
      const categoryRecord = await prisma.menuCategory.create({
        data: {
          restaurantId: restaurant.id,
          branchId: null,
          name: category.name,
          sortOrder: sortOrder++,
        },
      });
      for (const rawItem of category.items) {
        const item = rawItem as { name: string; price: number; station: string; stationAlt?: string; popular?: boolean; veg?: boolean; desc: string };
        const station = stationRecords.find((entry) => entry.name === (item.stationAlt || item.station));
        const menuItem = await prisma.menuItem.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: categoryRecord.id,
            stationId: station?.id ?? null,
            name: item.name,
            description: item.desc,
            priceCents: item.price,
            isVegetarian: item.veg ?? false,
            dietaryTags: item.veg ? ["Vegetarian"] : [],
            isPopular: item.popular ?? false,
            preparationMinutes: item.station === "Pizza" ? 18 : 10,
            sortOrder: sortOrder++,
          },
        });
        await prisma.itemVariation.createMany({
          data: [
            { restaurantId: restaurant.id, menuItemId: menuItem.id, name: "Regular", priceAdjustment: 0, sortOrder: 0 },
            { restaurantId: restaurant.id, menuItemId: menuItem.id, name: "Large", priceAdjustment: 200, sortOrder: 1 },
          ],
        });
        await prisma.itemAddon.createMany({
          data: [
            { restaurantId: restaurant.id, menuItemId: menuItem.id, name: "Extra Cheese", priceCents: 120, sortOrder: 0 },
            { restaurantId: restaurant.id, menuItemId: menuItem.id, name: "Extra Sauce", priceCents: 60, sortOrder: 1 },
          ],
        });
      }
    }

    const roleCodes = ["MANAGER", "WAITER", "KITCHEN", "CASHIER"];
    for (const [index, roleCode] of roleCodes.entries()) {
      const email = `${roleCode.toLowerCase()}@${demo.slug}.test`;
      let staff = await prisma.user.findUnique({ where: { email } });
      if (!staff) {
        staff = await prisma.user.create({
          data: { email, name: `${roleCode[0]}${roleCode.slice(1).toLowerCase()} ${demo.name}`, passwordHash },
        });
      }
      const role = await prisma.role.findFirstOrThrow({ where: { restaurantId: null, code: roleCode } });
      await ensureMembership(staff.id, restaurant.id, branchRecords[0].id, role.id);
      if (index === 0) {
        await ensureMembership(staff.id, restaurant.id, null, role.id);
      }
    }

    if (demo.slug === "pizza-house") {
      const firstTable = await prisma.restaurantTable.findFirstOrThrow({ where: { branchId: branchRecords[0].id } });
      const session = await prisma.tableSession.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branchRecords[0].id,
          tableId: firstTable.id,
          status: "OPEN",
        },
      });
      await prisma.restaurantTable.update({
        where: { id: firstTable.id },
        data: { status: "WAITING_FOR_FOOD", activeSessionId: session.id },
      });
      const guest = await prisma.guestSession.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branchRecords[0].id,
          tableSessionId: session.id,
          token: "demo-guest-token",
          displayName: "Demo Guest",
        },
      });
      const pizza = await prisma.menuItem.findFirstOrThrow({ where: { restaurantId: restaurant.id, name: "Margherita Pizza" } });
      const lemonade = await prisma.menuItem.findFirstOrThrow({ where: { restaurantId: restaurant.id, name: "Fresh Lemonade" } });
      const order = await prisma.order.create({
        data: {
          orderNumber: 1,
          restaurantId: restaurant.id,
          branchId: branchRecords[0].id,
          tableId: firstTable.id,
          tableSessionId: session.id,
          guestSessionId: guest.id,
          status: "PREPARING",
          source: "QR",
          customerName: "Demo Guest",
          subtotalCents: 1148,
          taxCents: 57,
          serviceCents: 34,
          totalCents: 1239,
          idempotencyKey: "demo-order-1",
          createdAt: new Date(Date.now() - 8 * 60000),
          acceptedAt: new Date(Date.now() - 7 * 60000),
          preparingAt: new Date(Date.now() - 6 * 60000),
          items: {
            create: [
              {
                restaurantId: restaurant.id,
                menuItemId: pizza.id,
                stationId: pizza.stationId,
                name: pizza.name,
                quantity: 1,
                unitPriceCents: pizza.priceCents,
                totalCents: pizza.priceCents,
                addons: [],
                status: "PREPARING",
              },
              {
                restaurantId: restaurant.id,
                menuItemId: lemonade.id,
                stationId: lemonade.stationId,
                name: lemonade.name,
                quantity: 1,
                unitPriceCents: lemonade.priceCents,
                totalCents: lemonade.priceCents,
                addons: [],
                status: "PREPARING",
              },
            ],
          },
        },
      });
      await prisma.bill.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branchRecords[0].id,
          tableSessionId: session.id,
          token: "demo-bill-token",
          totalCents: order.totalCents,
          status: "OPEN",
        },
      });
    }
  }

  console.log("Seed complete. Demo credentials: admin@restaurant.test / admin123, owner@pizzahouse.test / demo123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
