import { getRestaurantForPage } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function WaiterPage({ searchParams }: { searchParams: Promise<{ restaurant?: string }> }) {
  const { restaurant } = await searchParams;
  const { restaurantId } = await getRestaurantForPage(restaurant);
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId, isActive: true },
    orderBy: [{ section: "asc" }, { number: "asc" }],
    include: {
      branch: { select: { name: true } },
      activeSession: {
        include: {
          orders: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, orderNumber: true, status: true, totalCents: true } },
          bill: { select: { status: true, totalCents: true, paidCents: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Waiter" description="Table status and active sessions for floor service." actions={<Link href={`/app/orders?restaurant=${restaurantId}`}><Button variant="outline">All orders</Button></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => {
          const session = table.activeSession;
          return (
            <Card key={table.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>Table {table.number}</CardTitle>
                    <p className="text-xs text-slate-500">{table.branch.name}{table.section ? ` · ${table.section}` : ""}</p>
                  </div>
                  <Badge variant={table.status === "AVAILABLE" ? "success" : table.status === "BILL_REQUESTED" ? "warning" : table.status === "FOOD_READY" ? "success" : "info"}>
                    {table.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!session ? (
                  <p className="text-slate-500">No active session.</p>
                ) : (
                  <>
                    <p className="text-slate-600">{session.orders.length} recent order(s)</p>
                    {session.orders.slice(0, 3).map((o) => (
                      <div key={o.id} className="flex justify-between text-xs">
                        <span>#{o.orderNumber}</span>
                        <span className="text-slate-500">{o.status}</span>
                      </div>
                    ))}
                    {session.bill ? <p className="pt-1 text-xs text-slate-500">Bill: {session.bill.status}</p> : null}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
