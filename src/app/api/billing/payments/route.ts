import { handleRoute, ok, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { HttpError, requireApiUser, requireRestaurantAccess } from "@/lib/session";
import { recordPayment } from "@/services/billing";
import { z } from "zod";

const schema = z.object({
  restaurantId: z.string().min(1),
  billToken: z.string().min(1),
  amountCents: z.number().int().positive(),
  method: z.enum(["CASH", "ONLINE"]),
  splitId: z.string().nullable().optional(),
  allowTip: z.boolean().optional(),
  idempotencyKey: z.string().min(8),
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

    const result = await recordPayment({
      billToken: body.billToken,
      amountCents: body.amountCents,
      method: body.method,
      splitId: body.splitId,
      allowTip: body.allowTip,
      idempotencyKey: body.idempotencyKey,
      recordedByUserId: user.id,
      provider: body.method === "CASH" ? "cash" : "manual-online",
    });
    return ok(result);
  });
