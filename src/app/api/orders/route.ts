import { handleRoute, ok, readJson } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { getOrdersForRestaurant, updateOrderStatus } from "@/services/order";
import { z } from "zod";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurant");
    if (!restaurantId) throw new Error("Restaurant ID required");
    await requireRestaurantAccess(user, restaurantId, "order:read");
    const data = await getOrdersForRestaurant(restaurantId, {
      branchId: url.searchParams.get("branchId"),
      status: url.searchParams.get("status"),
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return ok(data);
  });

const statusSchema = z.object({
  restaurantId: z.string().min(1),
  orderId: z.string().min(1),
  status: z.string().min(1),
  reason: z.string().optional(),
});

export const PATCH = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const body = statusSchema.parse(await readJson(request));
    await requireRestaurantAccess(user, body.restaurantId, "order:update");
    const order = await updateOrderStatus({ ...body, actorId: user.id });
    return ok(order);
  });
