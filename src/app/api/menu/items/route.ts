import { handleRoute, ok, readJson } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  restaurantId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  stationId: z.string().nullable().optional(),
  isVegetarian: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const body = itemSchema.parse(await readJson(request));
    await requireRestaurantAccess(user, body.restaurantId, "menu:manage");
    const item = await prisma.menuItem.create({
      data: {
        restaurantId: body.restaurantId,
        categoryId: body.categoryId,
        name: body.name,
        description: body.description,
        priceCents: body.priceCents,
        stationId: body.stationId ?? null,
        isVegetarian: body.isVegetarian ?? false,
        isAvailable: body.isAvailable ?? true,
        dietaryTags: [],
      },
    });
    return ok(item, 201);
  });

const updateSchema = itemSchema.partial().extend({ id: z.string().min(1), restaurantId: z.string().min(1) });

export const PATCH = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const body = updateSchema.parse(await readJson(request));
    await requireRestaurantAccess(user, body.restaurantId, "menu:manage");
    const { id, restaurantId, ...data } = body;
    const item = await prisma.menuItem.update({ where: { id, restaurantId }, data });
    return ok(item);
  });
