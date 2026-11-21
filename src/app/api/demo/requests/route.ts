import { z } from "zod";
import { handleRoute, ok, readJson } from "@/lib/api";
import { createDemoRequest } from "@/services/demo-access";

const schema = z.object({
  email: z.string().email(),
  restaurantName: z.string().max(120).optional(),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const body = schema.parse(await readJson(request));
    const demoRequest = await createDemoRequest(body.email, body.restaurantName);
    return ok({ id: demoRequest.id, email: demoRequest.email }, 201);
  });
