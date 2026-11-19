import { handleRoute, ok, readJson } from "@/lib/api";
import { getGuestByToken } from "@/services/qr";
import { getCartView, removeCartItem, updateCartItem } from "@/services/cart";
import { z } from "zod";

const schema = z.object({
  guestToken: z.string().min(1),
  quantity: z.number().int().min(0).max(50),
});

export const PATCH = (request: Request, { params }: { params: Promise<{ itemId: string }> }) =>
  handleRoute(async () => {
    const { itemId } = await params;
    const body = schema.parse(await readJson(request));
    const guest = await getGuestByToken(body.guestToken);
    await updateCartItem(guest, itemId, body.quantity);
    return ok(await getCartView(guest));
  });

export const DELETE = (request: Request, { params }: { params: Promise<{ itemId: string }> }) =>
  handleRoute(async () => {
    const { itemId } = await params;
    const token = new URL(request.url).searchParams.get("guest");
    if (!token) throw new Error("Guest token required");
    const guest = await getGuestByToken(token);
    await removeCartItem(guest, itemId);
    return ok(await getCartView(guest));
  });
