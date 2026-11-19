import { handleRoute, ok } from "@/lib/api";
import { resolveQrSession } from "@/services/qr";

export const GET = (_request: Request, { params }: { params: Promise<{ token: string }> }) =>
  handleRoute(async () => {
    const { token } = await params;
    const session = await resolveQrSession(token);
    return ok(session);
  });
