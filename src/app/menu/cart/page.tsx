"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetcher";
import { money } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type CartView = {
  items: Array<{ id: string; name: string; quantity: number; lineTotalCents: number; variationName: string | null; addonNames: string[] }>;
  subtotalCents: number;
  count: number;
};

function CartInner() {
  const search = useSearchParams();
  const router = useRouter();
  const guest = search.get("guest") || "";
  const qr = search.get("qr") || "";
  const { toast } = useToast();
  const [cart, setCart] = useState<CartView | null>(null);
  const [placing, setPlacing] = useState(false);

  const load = async () => {
    if (!guest) return;
    const data = await apiFetch<CartView>(`/api/public/cart?guest=${guest}`);
    setCart(data);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [guest]);

  const update = async (itemId: string, quantity: number) => {
    try {
      const data = await apiFetch<CartView>(`/api/public/cart/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ guestToken: guest, quantity }),
      });
      setCart(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update cart", "error");
    }
  };

  const place = async () => {
    setPlacing(true);
    try {
      const idempotencyKey = `${guest}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await apiFetch("/api/public/orders", {
        method: "POST",
        body: JSON.stringify({ guestToken: guest, idempotencyKey }),
      });
      toast("Order placed!", "success");
      router.push(`/bill/session?guest=${guest}${qr ? `&qr=${qr}` : ""}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to place order", "error");
    } finally {
      setPlacing(false);
    }
  };

  if (!cart) return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading cart…</div>;

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Your cart</h1>
        <Link href={qr ? `/menu/${qr}` : "#"} className="text-sm font-semibold text-orange-600">Back to menu</Link>
      </div>
      {cart.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Your cart is empty.</div>
      ) : (
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold text-slate-900">{item.name}</p>
                {item.variationName ? <p className="text-xs text-slate-500">{item.variationName}</p> : null}
                {item.addonNames.length ? <p className="text-xs text-slate-500">+ {item.addonNames.join(", ")}</p> : null}
                <p className="mt-1 text-sm font-semibold">{money(item.lineTotalCents, "PKR")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => update(item.id, item.quantity - 1)}>-</Button>
                <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                <Button variant="outline" size="sm" onClick={() => update(item.id, item.quantity + 1)}>+</Button>
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Subtotal</span><span className="font-semibold">{money(cart.subtotalCents, "PKR")}</span></div>
            <p className="mt-1 text-xs text-slate-500">Tax and service charges will be added on placement.</p>
          </div>
          <Button className="w-full" size="lg" onClick={place} disabled={placing}>{placing ? "Placing order…" : "Place order"}</Button>
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <CartInner />
    </Suspense>
  );
}

