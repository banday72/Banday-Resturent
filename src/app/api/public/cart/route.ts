import { handleRoute, ok, readJson } from "@/lib/api";
import { getGuestByToken } from "@/services/qr";
import { addToCart, clearCart, getCartView, removeCartItem, updateCartItem } from "@/services/cart";
import { z } from "zod";

const addSchema = z.object({
  guestToken: z.string().min(1),
  menuItemId: z.string().min(1),
  variationId: z.string().nullable().optional(),
  addonIds: z.array(z.string()).optional(),
  quantity: z.number().int().min(1).max(50).optional(),
  instructions: z.string().max(500).nullable().optional(),
});

export const GET = (request: Request) =>
  handleRoute(async () => {
    const token = new URL(request.url).searchParams.get("guest");
    if (!token) throw new Error("Guest token required");
    const guest = await getGuestByToken(token);
    return ok(await getCartView(guest));
  });

export const POST = (request: Request) =>
  handleRoute(async () => {
    const body = addSchema.parse(await readJson(request));
    const guest = await getGuestByToken(body.guestToken);
    await addToCart(guest, body);
    return ok(await getCartView(guest), 201);
  });

export const DELETE = (request: Request) =>
  handleRoute(async () => {
    const token = new URL(request.url).searchParams.get("guest");
    if (!token) throw new Error("Guest token required");
    const guest = await getGuestByToken(token);
    await clearCart(guest);
    return ok({ cleared: true });
  });
