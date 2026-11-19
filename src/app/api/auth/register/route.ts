import { handleRoute, ok, readJson } from "@/lib/api";
import { registerRestaurant } from "@/services/onboarding";
import { z } from "zod";

const schema = z.object({
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  restaurantName: z.string().min(2),
  slug: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
});

export const POST = (request: Request) =>
  handleRoute(async () => {
    const body = schema.parse(await readJson(request));
    const result = await registerRestaurant(body);
    return ok(result, 201);
  });
