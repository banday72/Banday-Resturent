import { handleRoute, ok } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { getAnalytics } from "@/services/analytics";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurant");
    if (!restaurantId) throw new Error("Restaurant ID required");
    await requireRestaurantAccess(user, restaurantId, "analytics:read");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const branchId = url.searchParams.get("branchId");
    const data = await getAnalytics(restaurantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      branchId,
    });
    return ok(data);
  });
