import { handleRoute, ok, readJson } from "@/lib/api";
import { requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { publicToken } from "@/lib/utils";
import { z } from "zod";

export const GET = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurant");
    if (!restaurantId) throw new Error("Restaurant ID required");
    await requireRestaurantAccess(user, restaurantId, "table:manage");
    const branchId = url.searchParams.get("branchId");
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId, ...(branchId ? { branchId } : {}) },
      orderBy: { number: "asc" },
      include: { branch: { select: { id: true, name: true } }, qrCode: true, activeSession: true },
    });
    return ok(tables);
  });

const tableSchema = z.object({
  restaurantId: z.string().min(1),
  branchId: z.string().min(1),
  number: z.string().min(1),
  seats: z.number().int().min(1).max(50).optional(),
  section: z.string().optional(),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiUser();
    const body = tableSchema.parse(await readJson(request));
    await requireRestaurantAccess(user, body.restaurantId, "table:manage");
    const table = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurantTable.create({
        data: {
          restaurantId: body.restaurantId,
          branchId: body.branchId,
          number: body.number,
          seats: body.seats ?? 4,
          section: body.section,
        },
      });
      const token = publicToken();
      await tx.qRCode.create({
        data: {
          restaurantId: body.restaurantId,
          branchId: body.branchId,
          tableId: created.id,
          token,
          url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/q/${token}`,
        },
      });
      return created;
    });
    return ok(table, 201);
  });
