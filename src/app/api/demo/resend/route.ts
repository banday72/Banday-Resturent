import { z } from "zod";
import { handleRoute, ok, readJson } from "@/lib/api";
import { requireApiSuperAdmin } from "@/lib/session";
import { resendDemoOtp } from "@/services/demo-access";

const schema = z.object({ requestId: z.string().min(1) });

export const POST = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiSuperAdmin();
    const body = schema.parse(await readJson(request));
    await resendDemoOtp(body.requestId);
    return ok({ email: user.email ?? null });
  });
