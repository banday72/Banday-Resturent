"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Th, Td } from "@/components/ui/table";
import { apiFetch, withRestaurant } from "@/lib/fetcher";
import { useToast } from "@/components/ui/toast";
import { useRealtime } from "@/hooks/use-realtime";
import { money } from "@/lib/utils";

type Order = { id: string; orderNumber: number; tableName: string | null; status: string; totalCents: number; createdAt: string; items: Array<{ name: string; quantity: number }> };

const statuses = ["ALL", "NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"];
const nextStatus: Record<string, string> = { NEW: "ACCEPTED", ACCEPTED: "PREPARING", PREPARING: "READY", READY: "SERVED", SERVED: "COMPLETED" };

export default function OrdersPage() {
  const search = useSearchParams();
  const restaurantId = search.get("restaurant") || "";
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [rtToken, setRtToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const url = withRestaurant("/api/orders", restaurantId) + (filter !== "ALL" ? `&status=${filter}` : "");
    const data = await apiFetch<Order[]>(url);
    setOrders(data);
    setLoading(false);
  }, [restaurantId, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!restaurantId) return;
    apiFetch<{ token: string }>(withRestaurant("/api/realtime/token", restaurantId)).then((d) => setRtToken(d.token)).catch(() => {});
  }, [restaurantId]);

  useRealtime({
    token: rtToken,
    events: ["order:created", "order:status"],
    onEvent: () => { load(); },
  });

  const advance = async (order: Order) => {
    const status = nextStatus[order.status];
    if (!status) return;
    try {
      await apiFetch("/api/orders", { method: "PATCH", body: JSON.stringify({ restaurantId, orderId: order.id, status }) });
      toast(`Order #${order.orderNumber} ? ${status}`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update", "error");
    }
  };

  const cancel = async (order: Order) => {
    try {
      await apiFetch("/api/orders", { method: "PATCH", body: JSON.stringify({ restaurantId, orderId: order.id, status: "CANCELLED", reason: "Cancelled by staff" }) });
      toast(`Order #${order.orderNumber} cancelled`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to cancel", "error");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" description="Live order management for your restaurant." />
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === s ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{s}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-8 text-sm text-slate-500">Loading orders…</div> : orders.length === 0 ? <div className="p-8 text-sm text-slate-500">No orders found.</div> : (
          <Table>
            <thead><tr><Th>Order</Th><Th>Table</Th><Th>Items</Th><Th>Status</Th><Th>Total</Th><Th>Time</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <Td className="font-semibold">#{order.orderNumber}</Td>
                  <Td>{order.tableName ?? "—"}</Td>
                  <Td className="max-w-xs truncate text-xs text-slate-500">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</Td>
                  <Td><Badge variant={order.status === "CANCELLED" ? "danger" : order.status === "READY" || order.status === "COMPLETED" ? "success" : order.status === "NEW" ? "warning" : "info"}>{order.status}</Badge></Td>
                  <Td className="font-semibold">{money(order.totalCents, "PKR")}</Td>
                  <Td className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString()}</Td>
                  <Td>
                    <div className="flex gap-1">
                      {nextStatus[order.status] ? <Button size="sm" onClick={() => advance(order)}>{nextStatus[order.status]}</Button> : null}
                      {["NEW", "ACCEPTED", "PREPARING"].includes(order.status) ? <Button size="sm" variant="danger" onClick={() => cancel(order)}>Cancel</Button> : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
