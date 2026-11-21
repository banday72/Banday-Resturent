import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";

type BillOrderItem = { id: string; name: string; quantity: number; totalCents: number };
type BillOrder = { id: string; orderNumber: string; status: string; items: BillOrderItem[] };
type BillSplit = { id: string; label: string; assignedCents: number; paidCents: number; status: string };
type BillPayment = { id: string; amountCents: number; method: string; status: string };

async function getBill(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/public/bill/${token}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return json.ok ? json.data : null;
}

export default async function BillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const bill = await getBill(token);
  if (!bill) notFound();
  const currency = bill.restaurant?.currency ?? "PKR";
  const outstandingCents = bill.totalCents + bill.tipCents - bill.paidCents;

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{bill.restaurant?.name} - Bill</CardTitle>
          <p className="text-sm text-slate-500">Table {bill.table?.number} - {bill.branch?.name}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {bill.orders?.map((order: BillOrder) => (
              <div key={order.id} className="rounded-xl border border-slate-100 p-3">
                <div className="mb-1 flex justify-between text-sm font-semibold"><span>Order #{order.orderNumber}</span><span>{order.status}</span></div>
                {order.items?.map((item: BillOrderItem) => (
                  <div key={item.id} className="flex justify-between text-sm text-slate-600">
                    <span>{item.quantity} x {item.name}</span><span>{money(item.totalCents, currency)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Total</span><span className="font-semibold">{money(bill.totalCents, currency)}</span></div>
            <div className="flex justify-between"><span>Paid</span><span>{money(bill.paidCents, currency)}</span></div>
            {bill.tipCents ? <div className="flex justify-between"><span>Tip</span><span>{money(bill.tipCents, currency)}</span></div> : null}
            <div className="flex justify-between text-base font-bold"><span>Outstanding</span><span>{money(outstandingCents, currency)}</span></div>
          </div>
          {bill.splits?.length ? (
            <div className="space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <p className="font-semibold text-slate-800">Split payments</p>
              {bill.splits.map((split: BillSplit) => (
                <div key={split.id} className="flex justify-between text-slate-600">
                  <span>{split.label}</span>
                  <span>{money(split.paidCents, currency)} / {money(split.assignedCents, currency)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {bill.payments?.length ? (
            <div className="space-y-2 rounded-xl border border-slate-100 p-3 text-sm">
              <p className="font-semibold text-slate-800">Payments received</p>
              {bill.payments.map((payment: BillPayment) => (
                <div key={payment.id} className="flex justify-between text-slate-600">
                  <span>{payment.method.replace(/_/g, " ")} - {payment.status}</span>
                  <span>{money(payment.amountCents, currency)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Status: <span className="font-semibold text-slate-900">{bill.status}</span></div>
          <p className="text-xs text-slate-500">
            {outstandingCents > 0 ? "Pay your waiter to settle this bill. Paid amounts appear here automatically." : "This bill is fully paid. Thank you!"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
