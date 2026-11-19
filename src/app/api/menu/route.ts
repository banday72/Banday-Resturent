import { handleRoute, ok, readJson } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const restaurantId = new URL(request.url).searchParams.get("restaurant");
    if (!restaurantId) throw new Error("Restaurant ID required");
    await requireRestaurantAccess(user, restaurantId, "menu:manage");
    const [categories, stations] = await Promise.all([
      prisma.menuCategory.findMany({
        where: { restaurantId },
        orderBy: { sortOrder: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" }, include: { variations: true, addons: true, station: true } } },
      }),
      prisma.kitchenStation.findMany({ where: { restaurantId }, orderBy: { name: "asc" } }),
    ]);
    return ok({ categories, stations });
  });

const categorySchema = z.object({
  restaurantId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const body = categorySchema.parse(await readJson(request));
    await requireRestaurantAccess(user, body.restaurantId, "menu:manage");
    const category = await prisma.menuCategory.create({ data: { restaurantId: body.restaurantId, name: body.name, description: body.description } });
    return ok(category, 201);
  });
