import { handleRoute, ok } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { getKitchenOrders } from "@/services/order";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurant");
    if (!restaurantId) throw new Error("Restaurant ID required");
    await requireRestaurantAccess(user, restaurantId, "kitchen:manage");
    const stationId = url.searchParams.get("stationId");
    return ok(await getKitchenOrders(restaurantId, stationId));
  });
