import { handleRoute, ok } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { signRealtimeToken } from "../../../../../realtime-token.mjs";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const restaurantId = new URL(request.url).searchParams.get("restaurant");
    if (!restaurantId) throw new Error("Restaurant ID required");
    await requireRestaurantAccess(user, restaurantId, "order:read");
    const membership = user.isSuperAdmin
      ? null
      : user.memberships.find((item) => item.restaurantId === restaurantId);
    const token = signRealtimeToken({
      scope: "staff",
      restaurantId,
      branchId: membership?.branchId ?? null,
      userId: user.id,
    });
    return ok({ token });
  });
