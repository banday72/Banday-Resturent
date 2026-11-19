import { handleRoute, ok, readJson } from "@/lib/api";
import { getGuestByToken } from "@/services/qr";
import { placeOrder } from "@/services/order";
import { getOrdersForRestaurant } from "@/services/order";
import { z } from "zod";

const schema = z.object({
  guestToken: z.string().min(1),
  idempotencyKey: z.string().min(8),
  customerName: z.string().max(120).nullable().optional(),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const body = schema.parse(await readJson(request));
    await getGuestByToken(body.guestToken);
    const order = await placeOrder(body);
    return ok(order, 201);
  });

export const GET = (request: Request) =>
  handleRoute(async () => {
    const url = new URL(request.url);
    const guestToken = url.searchParams.get("guest");
    if (!guestToken) throw new Error("Guest token required");
    const guest = await getGuestByToken(guestToken);
    const orders = await getOrdersForRestaurant(guest.restaurantId, { tableSessionId: guest.tableSessionId });
    return ok(orders.filter((order) => guest.mode === "GROUP" || !order.guestSessionId || order.guestSessionId === guest.id));
  });
