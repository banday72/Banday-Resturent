import { handleRoute, ok } from "@/lib/api";
import { getGuestByToken, getPublicMenu } from "@/services/qr";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const token = new URL(request.url).searchParams.get("guest");
    if (!token) throw new Error("Guest token required");
    const guest = await getGuestByToken(token);
    const categories = await getPublicMenu(guest.restaurantId, guest.branchId);
    return ok({ categories });
  });
