import { handleRoute, ok, readJson } from "@/lib/api";
import { getGuestByToken } from "@/services/qr";
import { getBillByToken, requestBill } from "@/services/billing";
import { z } from "zod";

const schema = z.object({ guestToken: z.string().min(1) });

export const POST = (request: Request) =>
  handleRoute(async () => {
    const body = schema.parse(await readJson(request));
    const guest = await getGuestByToken(body.guestToken);
    const bill = await requestBill(guest.tableSessionId, guest.id);
    return ok({ billToken: bill.token, status: bill.status });
  });
