import { getRestaurantForPage } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ restaurant?: string }> }) {
  const { restaurant } = await searchParams;
  const { restaurantId } = await getRestaurantForPage(restaurant);
  const data = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true, branches: { orderBy: { createdAt: "asc" } }, subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!data) return null;
  const subscription = data.subscriptions[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Restaurant profile, branches and subscription." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Restaurant profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={data.name} />
            <Row label="Slug" value={data.slug} />
            <Row label="Email" value={data.email} />
            <Row label="Phone" value={data.phone ?? "—"} />
            <Row label="City" value={data.city ?? "—"} />
            <Row label="Currency" value={data.currency} />
            <Row label="Timezone" value={data.timezone} />
            <Row label="Tax rate" value={`${(data.taxRateBps / 100).toFixed(2)}%`} />
            <Row label="Service charge" value={`${(data.serviceChargeBps / 100).toFixed(2)}%`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ordering & payments</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Individual ordering" value={data.settings?.allowIndividualOrdering ? "Enabled" : "Disabled"} />
            <Row label="Group ordering" value={data.settings?.allowGroupOrdering ? "Enabled" : "Disabled"} />
            <Row label="Default mode" value={data.settings?.defaultOrderMode ?? "INDIVIDUAL"} />
            <Row label="Require customer name" value={data.settings?.requireCustomerName ? "Yes" : "No"} />
            <Row label="Auto-accept orders" value={data.settings?.autoAcceptOrders ? "Yes" : "No"} />
            <Row label="Online payments" value={data.settings?.onlinePaymentsEnabled ? "Enabled" : "Disabled"} />
            <Row label="Sound alerts" value={data.settings?.soundAlerts ? "On" : "Off"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Branches</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.branches.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <div><p className="font-medium text-slate-900">{b.name}</p><p className="text-xs text-slate-500">{b.code}{b.address ? ` · ${b.address}` : ""}</p></div>
                <span className={`text-xs font-semibold ${b.isActive ? "text-emerald-600" : "text-slate-400"}`}>{b.isActive ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {subscription ? (
              <>
                <Row label="Plan" value={subscription.plan.name} />
                <Row label="Status" value={subscription.status} />
                <Row label="Period end" value={new Date(subscription.currentPeriodEnd).toLocaleDateString()} />
                <Row label="Days remaining" value={subscription.status === "TRIALING" ? String(Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86_400_000))) : "—"} />
                <Row label="Cancel at period end" value={subscription.cancelAtPeriodEnd ? "Yes" : "No"} />
              </>
            ) : <p className="text-slate-500">No subscription found.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-50 py-1.5"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-900 text-right">{value}</span></div>;
}
