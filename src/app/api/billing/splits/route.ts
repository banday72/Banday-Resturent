import { handleRoute, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { HttpError, requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { configureSplit } from "@/services/billing";
import { z } from "zod";

const allocationSchema = z.object({
  label: z.string().min(1).max(80),
  amountCents: z.number().int().positive(),
  guestSessionId: z.string().nullable().optional(),
});

const schema = z.object({
  restaurantId: z.string().min(1),
  billToken: z.string().min(1),
  type: z.enum(["FULL", "EQUAL", "ITEMS", "CUSTOM"]),
  label: z.string().max(80).optional(),
  allocations: z.array(allocationSchema).optional(),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const body = schema.parse(await readJson(request));
    const user = await requireApiUser();
    await requireRestaurantAccess(user, body.restaurantId, "bill:manage");
    const bill = await prisma.bill.findFirst({
      where: { token: body.billToken, restaurantId: body.restaurantId },
      select: { id: true },
    });
    if (!bill) throw new HttpError(404, "Bill not found");

    const splits = await configureSplit(body.billToken, {
      type: body.type,
      label: body.label,
      allocations: body.allocations,
    });
    return ok(splits, 201);
  });
