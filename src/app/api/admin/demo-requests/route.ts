import { z } from "zod";
import { handleRoute, ok, readJson } from "@/lib/api";
import { requireApiSuperAdmin } from "@/lib/session";
import { approveDemoRequest, rejectDemoRequest } from "@/services/demo-access";

const schema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const user = await requireApiSuperAdmin();
    const body = schema.parse(await readJson(request));
    const adminEmail = user.email ?? "super-admin";
    if (body.action === "approve") {
      return ok(await approveDemoRequest(body.requestId, adminEmail));
    }
    return ok(await rejectDemoRequest(body.requestId, adminEmail));
  });
