import { getRestaurantForPage } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalytics } from "@/services/analytics";
import { money } from "@/lib/utils";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ restaurant?: string; from?: string; to?: string }> }) {
  const { restaurant } = await searchParams;
  const { restaurantId } = await getRestaurantForPage(restaurant);
  const analytics = await getAnalytics(restaurantId);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Sales, items, payments and operations insights." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Total sales</p><p className="mt-2 text-2xl font-bold">{money(analytics.totalSalesCents, "PKR")}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Collected</p><p className="mt-2 text-2xl font-bold">{money(analytics.collectedCents, "PKR")}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Orders</p><p className="mt-2 text-2xl font-bold">{analytics.totalOrders}</p><p className="text-xs text-slate-500">{analytics.completedOrders} completed · {analytics.cancelledOrders} cancelled</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Avg. order</p><p className="mt-2 text-2xl font-bold">{money(analytics.averageOrderValueCents, "PKR")}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Best sellers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.bestSellers.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : analytics.bestSellers.map((item) => (
              <div key={item.name} className="flex justify-between text-sm"><span className="font-medium">{item.name}</span><span className="text-slate-500">{item.quantity} sold · {money(item.revenueCents, "PKR")}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Sales by category</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.salesByCategory.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : analytics.salesByCategory.map((item) => (
              <div key={item.name} className="flex justify-between text-sm"><span className="font-medium">{item.name}</span><span className="text-slate-500">{item.quantity} items · {money(item.revenueCents, "PKR")}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment methods</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.paymentMethodBreakdown.length === 0 ? <p className="text-sm text-slate-500">No payments recorded today.</p> : analytics.paymentMethodBreakdown.map((item) => (
              <div key={item.method} className="flex justify-between text-sm"><span className="font-medium">{item.method}</span><span className="text-slate-500">{item.count} payments · {money(item.amountCents, "PKR")}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Table occupancy</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.tableOccupancy.length === 0 ? <p className="text-sm text-slate-500">No tables.</p> : analytics.tableOccupancy.map((item) => (
              <div key={item.status} className="flex justify-between text-sm"><span className="font-medium">{item.status.replace(/_/g, " ")}</span><span className="text-slate-500">{item.count}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
