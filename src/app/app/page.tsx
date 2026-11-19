import { getRestaurantForPage } from "@/lib/session";
import { PageHeader, StatCard, LoadingBlock } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalytics } from "@/services/analytics";
import { money } from "@/lib/utils";
import { BarChart3, ShoppingBag, Users, CreditCard } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ restaurant?: string }> }) {
  const { restaurant } = await searchParams;
  const { restaurantId, accessible } = await getRestaurantForPage(restaurant);
  const active = accessible.find((item) => item.id === restaurantId);
  const analytics = await getAnalytics(restaurantId).catch(() => null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Overview · ${active?.name ?? "Restaurant"}`}
        description="Today’s performance at a glance."
        actions={<Link href={`/app/orders?restaurant=${restaurantId}`} className="text-sm font-semibold text-orange-600 hover:underline">View live orders ?</Link>}
      />
      {!analytics ? (
        <LoadingBlock label="Analytics unavailable yet" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Today's sales" value={money(analytics.totalSalesCents, "PKR")} hint={`${analytics.totalOrders} orders`} icon={<BarChart3 className="h-5 w-5" />} tone="primary" />
            <StatCard label="Collected" value={money(analytics.collectedCents, "PKR")} hint="Payments received today" icon={<CreditCard className="h-5 w-5" />} tone="success" />
            <StatCard label="Pending orders" value={String(analytics.pendingOrders)} hint="New, accepted, preparing" icon={<ShoppingBag className="h-5 w-5" />} tone="warning" />
            <StatCard label="Avg. order" value={money(analytics.averageOrderValueCents, "PKR")} hint={`Lifetime ${money(analytics.lifetimeAverageCents, "PKR")}`} icon={<Users className="h-5 w-5" />} tone="info" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Best sellers (today)</CardTitle></CardHeader>
              <CardContent>
                {analytics.bestSellers.length === 0 ? (
                  <p className="text-sm text-slate-500">No sales yet today.</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.bestSellers.slice(0, 6).map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{item.name}</span>
                        <span className="text-slate-500">{item.quantity} sold · {money(item.revenueCents, "PKR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
              <CardContent>
                {analytics.recentOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent orders.</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">#{order.orderNumber} · Table {order.table}</span>
                        <span className="text-slate-500">{order.status} · {money(order.totalCents, "PKR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
