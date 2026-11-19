"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, withRestaurant } from "@/lib/fetcher";
import { useRealtime } from "@/hooks/use-realtime";
import { useToast } from "@/components/ui/toast";
import { money } from "@/lib/utils";

type KitchenOrder = { id: string; orderNumber: number; tableName: string | null; status: string; createdAt: string; totalCents: number; items: Array<{ id: string; name: string; quantity: number; variationName: string | null; instructions: string | null; status: string }> };

const next: Record<string, string> = { NEW: "ACCEPTED", ACCEPTED: "PREPARING", PREPARING: "READY" };

export default function KitchenPage() {
  const search = useSearchParams();
  const restaurantId = search.get("restaurant") || "";
  const { toast } = useToast();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const data = await apiFetch<KitchenOrder[]>(withRestaurant("/api/kitchen", restaurantId));
    setOrders(data);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (restaurantId) apiFetch<{ token: string }>(withRestaurant("/api/realtime/token", restaurantId)).then((d) => setToken(d.token)).catch(() => {}); }, [restaurantId]);
  useRealtime({ token, events: ["order:created", "order:status"], onEvent: () => load() });

  const advance = async (order: KitchenOrder) => {
    const status = next[order.status];
    if (!status) return;
    try {
      await apiFetch("/api/orders", { method: "PATCH", body: JSON.stringify({ restaurantId, orderId: order.id, status }) });
      toast(`Order #${order.orderNumber} ? ${status}`, "success");
      load();
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const columns = ["NEW", "ACCEPTED", "PREPARING", "READY"] as const;
  return (
    <div className="space-y-4">
      <PageHeader title="Kitchen" description="Station tickets and preparation flow." />
      <div className="grid gap-4 lg:grid-cols-4">
        {columns.map((status) => (
          <div key={status} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800">{status}</h3><Badge variant={status === "READY" ? "success" : status === "NEW" ? "warning" : "info"}>{orders.filter((o) => o.status === status).length}</Badge></div>
            <div className="space-y-3">
              {orders.filter((o) => o.status === status).map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between"><p className="font-bold text-slate-900">#{order.orderNumber}</p><span className="text-xs text-slate-500">Table {order.tableName ?? "—"}</span></div>
                    <div className="space-y-1 text-sm text-slate-700">
                      {order.items.map((item) => (
                        <div key={item.id}>
                          <span className="font-semibold">{item.quantity}×</span> {item.name}
                          {item.variationName ? <span className="text-slate-500"> ({item.variationName})</span> : null}
                          {item.instructions ? <p className="text-xs text-amber-700">Note: {item.instructions}</p> : null}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString()}</span>
                      {next[order.status] ? <Button size="sm" onClick={() => advance(order)}>{next[order.status]}</Button> : <Badge variant="success">Ready</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {orders.filter((o) => o.status === status).length === 0 ? <p className="py-6 text-center text-xs text-slate-400">No tickets</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
