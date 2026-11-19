import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";

export default async function OnboardingPage() {
  const session = await getAppSession();
  if (session?.user) redirect("/app");
  redirect("/register");
}
