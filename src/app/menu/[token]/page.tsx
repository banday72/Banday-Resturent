"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingCart, ChevronLeft, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/fetcher";
import { money } from "@/lib/utils";

type Category = { id: string; name: string; items: Array<{ id: string; name: string; description: string | null; priceCents: number; imageUrl: string | null; variations: Array<{ id: string; name: string; priceAdjustment: number }>; addons: Array<{ id: string; name: string; priceCents: number }> }> };

type CartView = { items: Array<{ id: string; menuItemId: string; name: string; quantity: number; lineTotalCents: number; variationName: string | null; addonNames: string[]; instructions: string | null }>; subtotalCents: number; count: number };

type GuestCtx = { guest: { token: string; mode: string }; restaurant: { name: string; currency?: string }; table: { number: string | number }; branch: { name: string } };


export default function MenuPage() {
  const params = useSearchParams();
  const qrToken = typeof window === "undefined" ? "" : window.location.pathname.split("/").pop() || "";
  const { toast } = useToast();
  const [ctx, setCtx] = useState<GuestCtx | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartView>({ items: [], subtotalCents: 0, count: 0 });
  const [selected, setSelected] = useState<Category["items"][number] | null>(null);
  const [variationId, setVariationId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const guestToken = localStorage.getItem(`guest:${qrToken}`);
    const stored = guestToken ? localStorage.getItem(`guestctx:${guestToken}`) : null;
    if (!stored || !guestToken) return;
    const parsed = JSON.parse(stored);
    setCtx(parsed);
    (async () => {
      try {
        const menu = await apiFetch<{ categories: Category[] }>(`/api/public/menu?guest=${guestToken}`);
        const cartData = await apiFetch<CartView>(`/api/public/cart?guest=${guestToken}`);
        setCategories(menu.categories);
        setCart(cartData);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to load menu", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [qrToken, toast]);

  const currency = ctx?.restaurant?.currency ?? "PKR";

  const openItem = (item: Category["items"][number]) => {
    setSelected(item);
    setVariationId(item.variations[0]?.id ?? null);
    setAddonIds([]);
    setQty(1);
  };

  const add = async () => {
    if (!selected || !ctx) return;
    try {
      const data = await apiFetch<CartView>("/api/public/cart", {
        method: "POST",
        body: JSON.stringify({ guestToken: ctx.guest.token, menuItemId: selected.id, variationId, addonIds, quantity: qty }),
      });
      setCart(data);
      setSelected(null);
      toast("Added to cart", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add item", "error");
    }
  };

  if (!ctx) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Preparing your menu�</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">{ctx.restaurant.name}</p>
            <h1 className="text-lg font-bold text-slate-900">Table {ctx.table.number}</h1>
            <p className="text-xs text-slate-500">{ctx.branch.name} � {ctx.guest.mode === "GROUP" ? "Group cart" : "Your cart"}</p>
          </div>
          <Link href={`/bill/session?guest=${ctx.guest.token}`} className="text-sm font-semibold text-slate-600 hover:text-slate-900">Orders & bill</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {loading ? <p className="text-sm text-slate-500">Loading menu�</p> : null}
        {categories.map((category) => (
          <section key={category.id}>
            <h2 className="mb-3 text-lg font-bold text-slate-900">{category.name}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {category.items.map((item) => (
                <button key={item.id} onClick={() => openItem(item)} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-orange-200 hover:shadow">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-2xl">???</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      <span className="text-sm font-bold text-slate-900">{money(item.priceCents, currency)}</span>
                    </div>
                    {item.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.variations.length ? <Badge variant="default">{item.variations.length} sizes</Badge> : null}
                      {item.addons.length ? <Badge variant="default">{item.addons.length} add-ons</Badge> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>

      {cart.count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{cart.count} items � {money(cart.subtotalCents, currency)}</p>
              <p className="text-xs text-slate-500">Taxes and service calculated at checkout</p>
            </div>
            <Link href={`/menu/cart?guest=${ctx.guest.token}&qr=${qrToken}`}>
              <Button><ShoppingCart className="h-4 w-4" /> View cart</Button>
            </Link>
          </div>
        </div>
      ) : null}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? "Item"}>
        {selected ? (
          <div className="space-y-4">
            {selected.description ? <p className="text-sm text-slate-600">{selected.description}</p> : null}
            {selected.variations.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Choose size</p>
                <div className="flex flex-wrap gap-2">
                  {selected.variations.map((variation) => (
                    <button key={variation.id} onClick={() => setVariationId(variation.id)} className={`rounded-lg border px-3 py-2 text-sm ${variationId === variation.id ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200"}`}>
                      {variation.name} {variation.priceAdjustment ? `(+${money(variation.priceAdjustment, currency)})` : ""}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {selected.addons.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add-ons</p>
                <div className="flex flex-wrap gap-2">
                  {selected.addons.map((addon) => {
                    const active = addonIds.includes(addon.id);
                    return (
                      <button key={addon.id} onClick={() => setAddonIds((ids) => active ? ids.filter((id) => id !== addon.id) : [...ids, addon.id])} className={`rounded-lg border px-3 py-2 text-sm ${active ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200"}`}>
                        {addon.name} (+{money(addon.priceCents, currency)})
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-semibold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"><Plus className="h-4 w-4" /></button>
              </div>
              <Button onClick={add}>Add to cart</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
