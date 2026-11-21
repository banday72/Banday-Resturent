import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { getSubscriptionStatus } from "@/services/onboarding";
import { getRestaurantForPage } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, accessible, restaurantId } = await getRestaurantForPage();
  const membership = user.memberships.find((item) => item.restaurantId === restaurantId);
  const role = user.isSuperAdmin ? "Super Admin" : (membership?.roleName ?? "Staff");
  const subscription = await getSubscriptionStatus(restaurantId);

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <DashboardShell
        userName={user.name ?? "User"}
        role={role}
        restaurants={accessible.map((item) => ({ id: item.id, name: item.name, slug: item.slug, logoUrl: item.logoUrl }))}
        activeRestaurantId={restaurantId}
        isSuperAdmin={user.isSuperAdmin}
        subscription={subscription}
      >
        {children}
      </DashboardShell>
    </Suspense>
  );
}
