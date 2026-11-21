import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/session";
import { publicToken } from "@/lib/utils";
import { attemptClerkEmailOtp, createClerkDemoUser, prepareClerkEmailOtp } from "@/services/clerk";

const DEMO_EMAIL_SUFFIX = "@demo.dinedesk.local";
const DEMO_RESTAURANT_SLUGS = ["dinedesk-pizza-demo", "dinedesk-cafe-demo"];

function accessHours() {
  const parsed = Number(process.env.DEMO_ACCESS_HOURS ?? 12);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}

export async function createDemoRequest(email: string, restaurantName?: string) {
  const normalized = email.trim().toLowerCase();
  const open = await prisma.demoRequest.findFirst({
    where: {
      email: normalized,
      status: { in: ["PENDING", "APPROVED"] },
      OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: new Date() } }],
    },
  });
  if (open) throw new HttpError(409, "A demo request for this email is already open");
  return prisma.demoRequest.create({
    data: { email: normalized, restaurantName: restaurantName?.trim() || null },
  });
}

export async function approveDemoRequest(id: string, adminEmail: string) {
  const request = await prisma.demoRequest.findUnique({ where: { id } });
  if (!request || request.status !== "PENDING") throw new HttpError(409, "Demo request is not pending");

  const clerk = await createClerkDemoUser({
    externalId: `demo-request-${request.id}`,
    email: request.email,
    name: request.restaurantName || "Demo User",
  });
  const verificationId = await prepareClerkEmailOtp(clerk.emailAddressId);

  const demoUserEmail = `demo-${request.id.toLowerCase()}${DEMO_EMAIL_SUFFIX}`;
  const passwordHash = await bcrypt.hash(publicToken(), 10);
  const accessExpiresAt = new Date(Date.now() + accessHours() * 3_600_000);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: demoUserEmail },
      create: { name: request.restaurantName || "Demo User", email: demoUserEmail, passwordHash },
      update: { passwordHash },
    });
    const managerRole = await tx.role.findFirst({ where: { restaurantId: null, code: "MANAGER" } });
    if (!managerRole) throw new HttpError(500, "Manager role is not initialized");
    const restaurants = await tx.restaurant.findMany({
      where: { slug: { in: DEMO_RESTAURANT_SLUGS } },
      select: { id: true },
    });
    for (const restaurant of restaurants) {
      const membership = await tx.restaurantMembership.findFirst({
        where: { userId: user.id, restaurantId: restaurant.id, branchId: null },
      });
      if (membership) {
        await tx.restaurantMembership.update({
          where: { id: membership.id },
          data: { isActive: true, roleId: managerRole.id },
        });
      } else {
        await tx.restaurantMembership.create({
          data: { userId: user.id, restaurantId: restaurant.id, roleId: managerRole.id },
        });
      }
    }
    await tx.demoRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        clerkUserId: clerk.clerkUserId,
        clerkEmailAddressId: clerk.emailAddressId,
        clerkVerificationId: verificationId,
        demoUserEmail,
        accessExpiresAt,
        approvedAt: new Date(),
        approvedByEmail: adminEmail,
      },
    });
  });

  return { id: request.id, email: request.email, accessExpiresAt };
}

export async function rejectDemoRequest(id: string, adminEmail: string) {
  const request = await prisma.demoRequest.findUnique({ where: { id } });
  if (!request || request.status !== "PENDING") throw new HttpError(409, "Demo request is not pending");
  return prisma.demoRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectedAt: new Date(), approvedByEmail: adminEmail, note: "Rejected by super admin" },
  });
}

export async function resendDemoOtp(id: string) {
  const request = await prisma.demoRequest.findUnique({ where: { id } });
  if (!request || request.status !== "APPROVED") throw new HttpError(409, "Demo request is not approved");
  if (!request.accessExpiresAt || request.accessExpiresAt <= new Date()) throw new HttpError(410, "Demo access has expired");
  if (!request.clerkEmailAddressId) throw new HttpError(409, "Demo email address is missing");
  const verificationId = await prepareClerkEmailOtp(request.clerkEmailAddressId);
  return prisma.demoRequest.update({
    where: { id },
    data: { clerkVerificationId: verificationId },
  });
}

export async function verifyDemoOtp(id: string, code: string) {
  const request = await prisma.demoRequest.findUnique({ where: { id } });
  if (!request || request.status !== "APPROVED") throw new HttpError(409, "Demo request is not approved");
  if (!request.accessExpiresAt || request.accessExpiresAt <= new Date()) throw new HttpError(410, "Demo access has expired");
  if (!request.clerkEmailAddressId || !request.clerkVerificationId || !request.demoUserEmail) {
    throw new HttpError(409, "Demo verification is not ready");
  }

  await attemptClerkEmailOtp(request.clerkEmailAddressId, request.clerkVerificationId, code);

  const password = publicToken();
  await prisma.user.update({
    where: { email: request.demoUserEmail },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  return { email: request.demoUserEmail, password, accessExpiresAt: request.accessExpiresAt };
}
