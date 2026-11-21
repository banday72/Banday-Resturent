import Link from "next/link";
import { requireSuperAdmin } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSuperAdminAnalytics } from "@/services/analytics";
import { prisma } from "@/lib/prisma";
import { cn, money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DemoRequestsPanel, type DemoRequestRow } from "@/components/admin/demo-requests-panel";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireSuperAdmin();
  const { filter } = await searchParams;
  const [analytics, restaurants, demoRequests] = await Promise.all([
    getSuperAdminAnalytics(),
    prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { branches: true, memberships: true, orders: true, items: true } },
      },
    }),
    prisma.demoRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const now = Date.now();
  const rows = restaurants.map((r) => {
    const sub = r.subscriptions[0];
    const subscriptionExpired = !sub || sub.currentPeriodEnd.getTime() <= now || ["CANCELLED", "SUSPENDED", "PAST_DUE"].includes(sub.status);
    const active = r.isActive && !subscriptionExpired;
    const status = !r.isActive ? "Suspended" : !sub ? "No plan" : subscriptionExpired ? "Expired" : sub.status === "TRIALING" ? "Trial" : "Active";
    const variant: "success" | "warning" | "danger" = active ? "success" : status === "No plan" ? "warning" : "danger";
    return { ...r, sub, active, status, variant };
  });
  const activeCount = rows.filter((row) => row.active).length;
  const visible = filter === "active" ? rows.filter((row) => row.active) : filter === "inactive" ? rows.filter((row) => !row.active) : rows;

  const filters = [
    { key: "all", label: "All", count: rows.length, href: "/admin" },
    { key: "active", label: "Active", count: activeCount, href: "/admin?filter=active" },
    { key: "inactive", label: "Inactive", count: rows.length - activeCount, href: "/admin?filter=inactive" },
  ];

  const demoRequestRows: DemoRequestRow[] = demoRequests.map((item) => ({
    id: item.id,
    email: item.email,
    restaurantName: item.restaurantName,
    status: item.status,
    accessExpiresAt: item.accessExpiresAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    approvedByEmail: item.approvedByEmail,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Super Admin" description="Platform-wide restaurants, subscriptions, products and revenue." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Active restaurants</p><p className="mt-2 text-2xl font-bold">{analytics.activeRestaurants}</p><p className="text-xs text-slate-500">of {analytics.totalRestaurants} total · {analytics.suspendedRestaurants} inactive</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Users</p><p className="mt-2 text-2xl font-bold">{analytics.totalUsers}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Orders</p><p className="mt-2 text-2xl font-bold">{analytics.totalOrders}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase text-slate-500">Platform revenue</p><p className="mt-2 text-2xl font-bold">{money(analytics.platformRevenueCents, "PKR")}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Restaurants</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            {filters.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  (filter ?? "all") === item.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {item.label} ({item.count})
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visible.length === 0 ? <p className="text-sm text-slate-500">No restaurants in this view.</p> : visible.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{r.name}</p><Badge variant={r.variant}>{r.status}</Badge></div>
                <p className="text-sm text-slate-500">{r.slug} · {r.owner.email}</p>
                <p className="mt-1 text-xs text-slate-500">{r._count.branches} branches · {r._count.items} products · {r._count.memberships} members · {r._count.orders} orders</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="text-sm text-slate-600">
                  {r.sub ? <><p className="font-medium text-slate-900">{r.sub.plan.name}</p><p className="text-xs">{r.sub.status} · ends {new Date(r.sub.currentPeriodEnd).toLocaleDateString()}</p></> : <p>No subscription</p>}
                </div>
                <div className="flex gap-2">
                  <Link href={`/app?restaurant=${r.id}`} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Open</Link>
                  <Link href={`/app/menu?restaurant=${r.id}`} className="inline-flex h-8 items-center justify-center rounded-lg bg-orange-500 px-3 text-xs font-semibold text-white hover:bg-orange-600">Add product</Link>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Demo requests</CardTitle></CardHeader>
        <CardContent><DemoRequestsPanel requests={demoRequestRows} /></CardContent>
      </Card>
    </div>
  );
}
