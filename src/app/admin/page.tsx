import { requireSuperAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSuperAdminAnalytics } from "@/services/analytics";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  await requireSuperAdmin();
  const [analytics, restaurants] = await Promise.all([
    getSuperAdminAnalytics(),
    prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { branches: true, memberships: true, orders: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Super Admin" description="Platform-wide restaurants, subscriptions and revenue." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Restaurants</p><p className="mt-2 text-2xl font-bold">{analytics.totalRestaurants}</p><p className="text-xs text-slate-500">{analytics.activeRestaurants} active · {analytics.suspendedRestaurants} suspended</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Users</p><p className="mt-2 text-2xl font-bold">{analytics.totalUsers}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Orders</p><p className="mt-2 text-2xl font-bold">{analytics.totalOrders}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Platform revenue</p><p className="mt-2 text-2xl font-bold">{money(analytics.platformRevenueCents, "PKR")}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Restaurants</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {restaurants.length === 0 ? <p className="text-sm text-slate-500">No restaurants yet.</p> : restaurants.map((r) => {
            const sub = r.subscriptions[0];
            return (
              <div key={r.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{r.name}</p><Badge variant={r.isActive ? "success" : "danger"}>{r.isActive ? "Active" : "Suspended"}</Badge></div>
                  <p className="text-sm text-slate-500">{r.slug} · {r.owner.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{r._count.branches} branches · {r._count.memberships} members · {r._count.orders} orders</p>
                </div>
                <div className="text-sm text-slate-600">
                  {sub ? <><p className="font-medium text-slate-900">{sub.plan.name}</p><p className="text-xs">{sub.status} · ends {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p></> : <p>No subscription</p>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
