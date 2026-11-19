import { getRestaurantForPage } from "@/lib/session";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ restaurant?: string }> }) {
  const { restaurant } = await searchParams;
  const { restaurantId } = await getRestaurantForPage(restaurant);
  const bills = await prisma.bill.findMany({
    where: { restaurantId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { tableSession: { include: { table: true, branch: true } }, payments: true },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Billing" description="Bills and payment status for table sessions." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bills.length === 0 ? <p className="text-sm text-slate-500">No bills yet.</p> : bills.map((bill) => (
          <Card key={bill.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Table {bill.tableSession.table.number}</CardTitle>
                <Badge variant={bill.status === "PAID" ? "success" : bill.status === "REQUESTED" ? "warning" : bill.status === "PARTIALLY_PAID" ? "info" : "default"}>{bill.status}</Badge>
              </div>
              <p className="text-xs text-slate-500">{bill.tableSession.branch.name}</p>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold">{money(bill.totalCents, "PKR")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{money(bill.paidCents, "PKR")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Outstanding</span><span className="font-semibold">{money(bill.totalCents + bill.tipCents - bill.paidCents, "PKR")}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payments</span><span>{bill.payments.length}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
