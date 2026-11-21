import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MembershipSession } from "@/types/next-auth";

export async function getAppSession() {
  return getServerSession(authOptions);
}

export async function requireUser() {
  const session = await getAppSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.email?.endsWith(DEMO_EMAIL_SUFFIX) && !(await findActiveDemoRequest(session.user.email))) {
    redirect("/demo/expired");
  }
  return session.user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/app");
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEMO_EMAIL_SUFFIX = "@demo.dinedesk.local";

async function findActiveDemoRequest(email?: string | null) {
  if (!email?.endsWith(DEMO_EMAIL_SUFFIX)) return null;
  const request = await prisma.demoRequest.findFirst({
    where: { demoUserEmail: email, status: "APPROVED" },
    orderBy: { approvedAt: "desc" },
  });
  if (!request?.accessExpiresAt || request.accessExpiresAt.getTime() <= Date.now()) return null;
  return request;
}

export async function requireApiUser() {
  const session = await getAppSession();
  if (!session?.user?.id) throw new HttpError(401, "Authentication required");
  if (session.user.email?.endsWith(DEMO_EMAIL_SUFFIX) && !(await findActiveDemoRequest(session.user.email))) {
    throw new HttpError(403, "Demo access has expired");
  }
  return session.user;
}

export async function requireApiSuperAdmin() {
  const user = await requireApiUser();
  if (!user.isSuperAdmin) throw new HttpError(403, "Super admin access required");
  return user;
}

export function findMembership(
  user: { memberships: MembershipSession[]; isSuperAdmin: boolean },
  restaurantId: string,
): MembershipSession | null {
  return user.memberships.find((membership) => membership.restaurantId === restaurantId) ?? null;
}

export async function requireRestaurantAccess(
  user: { id: string; isSuperAdmin: boolean; memberships: MembershipSession[] },
  restaurantId: string,
  permission?: string,
) {
  if (user.isSuperAdmin) return { restaurantId, role: "SUPER_ADMIN", permissions: ["*"] };
  const membership = findMembership(user, restaurantId);
  if (!membership) throw new HttpError(403, "You do not have access to this restaurant");
  if (!membership.restaurantActive) throw new HttpError(403, "This restaurant is suspended");
  if (permission && !membership.permissions.includes(permission) && !membership.permissions.includes("*")) {
    throw new HttpError(403, `Missing permission: ${permission}`);
  }
  return membership;
}

export async function requireRestaurantId(user: { id: string; isSuperAdmin: boolean; memberships: MembershipSession[] }, requested?: string | null) {
  if (requested) {
    await requireRestaurantAccess(user, requested);
    return requested;
  }
  if (user.memberships.length === 0) throw new HttpError(403, "No restaurant assigned to your account");
  return user.memberships[0].restaurantId;
}

export async function getRestaurantForPage(restaurantId?: string) {
  const user = await requireUser();
  const accessible = user.isSuperAdmin
    ? await prisma.restaurant.findMany({ select: { id: true, name: true, slug: true, logoUrl: true } })
    : user.memberships.map((membership) => ({
        id: membership.restaurantId,
        name: membership.restaurantName,
        slug: membership.restaurantSlug,
        logoUrl: membership.restaurantLogo,
      }));
  const activeId = restaurantId ?? accessible[0]?.id;
  if (!activeId) redirect("/onboarding");
  if (!accessible.some((item) => item.id === activeId)) redirect("/app");
  return { user, accessible, restaurantId: activeId };
}
