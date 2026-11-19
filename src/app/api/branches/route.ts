import { handleRoute, ok } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const restaurantId = new URL(request.url).searchParams.get("restaurant");
    if (!restaurantId) throw new Error("Restaurant ID required");
    await requireRestaurantAccess(user, restaurantId, "restaurant:read");
    const branches = await prisma.branch.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, code: true, address: true, phone: true, isActive: true },
    });
    return ok(branches);
  });
