import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/session";
import { slugify, publicToken } from "@/lib/utils";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

export type RegisterRestaurantInput = {
  ownerName: string;
  email: string;
  password: string;
  restaurantName: string;
  slug?: string;
  currency?: string;
  phone?: string;
  city?: string;
};

export async function registerRestaurant(input: RegisterRestaurantInput) {
  const email = input.email.trim().toLowerCase();
  const slug = slugify(input.slug || input.restaurantName);
  if (slug.length < 3) throw new HttpError(400, "Restaurant slug must be at least 3 characters");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "An account with this email already exists");
  const takenSlug = await prisma.restaurant.findUnique({ where: { slug } });
  if (takenSlug) throw new HttpError(409, "This restaurant URL is already taken");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const ownerRole = await prisma.role.findFirst({ where: { restaurantId: null, code: "OWNER" } });
  if (!ownerRole) throw new HttpError(500, "System roles are not initialized");

  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "FREE" } });
  if (!freePlan) throw new HttpError(500, "Subscription plans are not initialized");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.ownerName.trim(), email, passwordHash, phone: input.phone },
    });
    const restaurant = await tx.restaurant.create({
      data: {
        slug,
        name: input.restaurantName.trim(),
        email,
        phone: input.phone,
        city: input.city,
        currency: input.currency || "PKR",
        ownerId: user.id,
      },
    });
    await tx.restaurantSettings.create({
      data: {
        restaurantId: restaurant.id,
        paymentProviders: [],
        openingHours: {},
      },
    });
    await tx.branch.create({
      data: { restaurantId: restaurant.id, name: "Main Branch", code: "MAIN", openingHours: {} },
    });
    await tx.restaurantMembership.create({
      data: { userId: user.id, restaurantId: restaurant.id, roleId: ownerRole.id },
    });
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 14);
    await tx.subscription.create({
      data: {
        restaurantId: restaurant.id,
        planId: freePlan.id,
        status: "TRIALING",
        currentPeriodEnd: periodEnd,
      },
    });
    await tx.auditLog.create({
      data: {
        restaurantId: restaurant.id,
        userId: user.id,
        action: "RESTAURANT_REGISTERED",
        entityType: "Restaurant",
        entityId: restaurant.id,
        metadata: { slug },
      },
    });
    await tx.notification.create({
      data: {
        type: "NEW_RESTAURANT",
        title: "New restaurant registered",
        message: `${restaurant.name} joined the platform.`,
        data: { restaurantId: restaurant.id, slug },
      },
    });
    return { user: { id: user.id, email: user.email }, restaurant: { id: restaurant.id, slug } };
  });
}

export async function createRestaurantByAdmin(input: {
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  slug?: string;
  planCode?: string;
}) {
  const created = await registerRestaurant({
    ownerName: input.ownerName,
    email: input.ownerEmail,
    password: input.ownerPassword,
    restaurantName: input.name,
    slug: input.slug,
  });
  if (input.planCode && input.planCode !== "FREE") {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: input.planCode } });
    if (!plan) throw new HttpError(400, "Unknown plan");
    await prisma.subscription.updateMany({
      where: { restaurantId: created.restaurant.id },
      data: { planId: plan.id, status: "ACTIVE" },
    });
  }
  return created;
}

export async function assertPlanLimit(restaurantId: string, resource: "branches" | "tables" | "users") {
  const subscription = await prisma.subscription.findFirst({
    where: { restaurantId, status: { in: ["TRIALING", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  if (!subscription) throw new HttpError(403, "No active subscription");
  const limit = (subscription.plan.limits as Record<string, number>)[resource];
  if (limit === undefined || limit < 0) return;
  const counts = {
    branches: () => prisma.branch.count({ where: { restaurantId } }),
    tables: () => prisma.restaurantTable.count({ where: { restaurantId } }),
    users: () => prisma.restaurantMembership.count({ where: { restaurantId, isActive: true } }),
  };
  const current = await counts[resource]();
  if (current >= limit) throw new HttpError(403, `Your ${subscription.plan.name} plan allows ${limit} ${resource}`);
}

export async function seedSystemData() {
  await prisma.permission.upsert({
    where: { code: "system:bootstrap" },
    create: { code: "system:bootstrap", name: "System bootstrap", category: "System" },
    update: {},
  });
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        features: [...plan.features],
        limits: plan.limits as unknown as Record<string, number>,
        sortOrder: SUBSCRIPTION_PLANS.indexOf(plan as (typeof SUBSCRIPTION_PLANS)[number]),
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        features: [...plan.features],
        limits: plan.limits as unknown as Record<string, number>,
      },
    });
  }
  const { PERMISSIONS, ROLE_PERMISSIONS } = await import("@/lib/constants");
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: { code: permission.code, name: permission.name, category: permission.category },
      update: { name: permission.name, category: permission.category },
    });
  }
  const allRoles = ["SUPER_ADMIN", ...Object.keys(ROLE_PERMISSIONS)];
  for (const roleCode of allRoles) {
    const existingRole = await prisma.role.findFirst({ where: { restaurantId: null, code: roleCode } });
    const role = existingRole
      ? await prisma.role.update({
          where: { id: existingRole.id },
          data: { name: titleCase(roleCode), isSystem: true },
        })
      : await prisma.role.create({
          data: { restaurantId: null, code: roleCode, name: titleCase(roleCode), isSystem: true },
        });
    const codes = roleCode === "SUPER_ADMIN" ? PERMISSIONS.map((item) => item.code) : ROLE_PERMISSIONS[roleCode];
    for (const code of codes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function ensureQrToken() {
  return publicToken();
}
