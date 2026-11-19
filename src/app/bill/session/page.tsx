"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetcher";
import { money } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type Order = { id: string; orderNumber: number; status: string; totalCents: number; createdAt: string; items: Array<{ id: string; name: string; quantity: number; totalCents: number; variationName?: string | null }> };

export default function BillSessionPage() {
  const search = useSearchParams();
  const guest = search.get("guest") || "";
  const qr = search.get("qr") || "";
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [billToken, setBillToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const load = async () => {
    if (!guest) return;
    try {
      const data = await apiFetch<Order[]>(`/api/public/orders?guest=${guest}`);
      setOrders(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guest]);

  const requestBill = async () => {
    setRequesting(true);
    try {
      const data = await apiFetch<{ billToken: string; status: string }>("/api/public/bill/request", {
        method: "POST",
        body: JSON.stringify({ guestToken: guest }),
      });
      setBillToken(data.billToken);
      toast("Bill requested", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to request bill", "error");
    } finally {
      setRequesting(false);
    }
  };

  const total = orders.reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Your orders</h1>
        {qr ? <Link href={`/menu/${qr}`} className="text-sm font-semibold text-orange-600">Back to menu</Link> : null}
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {!loading && orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No orders placed yet.</div>
      ) : null}

      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Order #{order.orderNumber}</p>
              <Badge variant={order.status === "READY" ? "success" : order.status === "CANCELLED" ? "danger" : "info"}>{order.status}</Badge>
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.quantity}× {item.name}{item.variationName ? ` (${item.variationName})` : ""}</span>
                  <span>{money(item.totalCents, "PKR")}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
              <span>Total</span><span>{money(order.totalCents, "PKR")}</span>
            </div>
          </div>
        ))}
      </div>

      {orders.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-base font-bold text-slate-900">
            <span>Table total</span><span>{money(total, "PKR")}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Includes tax and service charges per order.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={requestBill} disabled={requesting}>{requesting ? "Requesting…" : "Request bill"}</Button>
            {billToken ? <Link href={`/bill/${billToken}`} className="flex-1"><Button variant="outline" className="w-full">View bill</Button></Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
