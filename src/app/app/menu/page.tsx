"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { apiFetch, withRestaurant } from "@/lib/fetcher";
import { useToast } from "@/components/ui/toast";
import { money } from "@/lib/utils";

type Menu = { categories: Array<{ id: string; name: string; items: Array<{ id: string; name: string; description: string | null; priceCents: number; isAvailable: boolean; isVegetarian: boolean; station: { name: string } | null }> }>; stations: Array<{ id: string; name: string }> };

export default function MenuPage() {
  const search = useSearchParams();
  const restaurantId = search.get("restaurant") || "";
  const { toast } = useToast();
  const [data, setData] = useState<Menu | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [item, setItem] = useState({ categoryId: "", name: "", priceCents: 0, description: "", stationId: "" });

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setData(await apiFetch<Menu>(withRestaurant("/api/menu", restaurantId)));
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await apiFetch("/api/menu", { method: "POST", body: JSON.stringify({ restaurantId, name: catName }) }); setCatName(""); setCatOpen(false); toast("Category added", "success"); load(); }
    catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/menu/items", { method: "POST", body: JSON.stringify({ restaurantId, categoryId: item.categoryId, name: item.name, priceCents: Math.round(item.priceCents), description: item.description || undefined, stationId: item.stationId || null }) });
      setItemOpen(false); setItem({ categoryId: "", name: "", priceCents: 0, description: "", stationId: "" }); toast("Item added", "success"); load();
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const toggle = async (id: string, isAvailable: boolean) => {
    try { await apiFetch("/api/menu/items", { method: "PATCH", body: JSON.stringify({ id, restaurantId, isAvailable: !isAvailable }) }); load(); }
    catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Menu" description="Categories and items." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setCatOpen(true)}>Add category</Button><Button onClick={() => { setItem({ ...item, categoryId: data?.categories[0]?.id ?? "" }); setItemOpen(true); }}>Add item</Button></div>} />
      {!data ? <p className="text-sm text-slate-500">Loading menu…</p> : data.categories.length === 0 ? <p className="text-sm text-slate-500">No categories yet. Create one to start building your menu.</p> : (
        <div className="space-y-6">
          {data.categories.map((category) => (
            <Card key={category.id}>
              <CardHeader><CardTitle>{category.name} <span className="ml-2 text-xs font-normal text-slate-500">({category.items.length} items)</span></CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {category.items.length === 0 ? <p className="text-sm text-slate-500">No items in this category.</p> : category.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{it.name}</p>{it.isVegetarian ? <Badge variant="success">Veg</Badge> : null}{!it.isAvailable ? <Badge variant="danger">Unavailable</Badge> : null}</div>
                      <p className="text-xs text-slate-500">{it.station?.name ? `Station: ${it.station.name} · ` : ""}{money(it.priceCents, "PKR")}</p>
                    </div>
                    <Button size="sm" variant={it.isAvailable ? "outline" : "success"} onClick={() => toggle(it.id, it.isAvailable)}>{it.isAvailable ? "Disable" : "Enable"}</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="Add category">
        <form onSubmit={addCategory} className="space-y-3">
          <div><Label>Name</Label><Input value={catName} onChange={(e) => setCatName(e.target.value)} required /></div>
          <Button type="submit" className="w-full">Create category</Button>
        </form>
      </Modal>

      <Modal open={itemOpen} onClose={() => setItemOpen(false)} title="Add menu item">
        <form onSubmit={addItem} className="space-y-3">
          <div><Label>Category</Label><Select value={item.categoryId} onChange={(e) => setItem({ ...item, categoryId: e.target.value })} required>{data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
          <div><Label>Name</Label><Input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} required /></div>
          <div><Label>Price (smallest unit, e.g. paisa/cents)</Label><Input type="number" min={0} value={item.priceCents} onChange={(e) => setItem({ ...item, priceCents: Number(e.target.value) })} required /></div>
          <div><Label>Station (optional)</Label><Select value={item.stationId} onChange={(e) => setItem({ ...item, stationId: e.target.value })}><option value="">None</option>{data?.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          <div><Label>Description</Label><Input value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} /></div>
          <Button type="submit" className="w-full">Create item</Button>
        </form>
      </Modal>
    </div>
  );
}
