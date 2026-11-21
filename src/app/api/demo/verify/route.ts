import { z } from "zod";
import { handleRoute, ok, readJson } from "@/lib/api";
import { verifyDemoOtp } from "@/services/demo-access";

const schema = z.object({
  requestId: z.string().min(1),
  code: z.string().min(4).max(8),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const body = schema.parse(await readJson(request));
    const result = await verifyDemoOtp(body.requestId, body.code.trim());
    return ok(result);
  });
