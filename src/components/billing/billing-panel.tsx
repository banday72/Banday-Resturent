"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/fetcher";
import { money } from "@/lib/utils";

export type BillView = {
  id: string;
  token: string;
  tableNumber: string;
  branchName: string;
  status: string;
  totalCents: number;
  paidCents: number;
  tipCents: number;
  splits: Array<{
    id: string;
    label: string;
    type: string;
    assignedCents: number;
    paidCents: number;
    status: string;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    method: string;
    status: string;
    createdAt: string;
  }>;
};

type Props = {
  bills: BillView[];
  restaurantId: string;
  currency: string;
  canManage: boolean;
};

const SPLIT_TYPES = ["FULL", "EQUAL", "ITEMS", "CUSTOM"] as const;

export function BillingPanel({ bills, restaurantId, currency, canManage }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(bills[0]?.id ?? "");
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState<"CASH" | "ONLINE">("CASH");
  const [splitId, setSplitId] = useState("");
  const [allowTip, setAllowTip] = useState(false);
  const [splitType, setSplitType] = useState<(typeof SPLIT_TYPES)[number]>("FULL");
  const [splitLabel, setSplitLabel] = useState("Table bill");
  const [allocations, setAllocations] = useState([{ label: "Guest 1", amount: "0" }]);
  const [busy, setBusy] = useState<"payment" | "split" | null>(null);

  const selected = useMemo(() => bills.find((bill) => bill.id === selectedId) ?? null, [bills, selectedId]);
  const outstandingCents = selected ? Math.max(0, selected.totalCents + selected.tipCents - selected.paidCents) : 0;

  useEffect(() => {
    setAmount((outstandingCents / 100).toFixed(2));
    setSplitId("");
    setAllowTip(false);
  }, [selectedId, outstandingCents]);

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const amountCents = Math.round(Number(amount) * 100);
    setBusy("payment");
    try {
      await apiFetch("/api/billing/payments", {
        method: "POST",
        body: JSON.stringify({
          restaurantId,
          billToken: selected.token,
          amountCents,
          method,
          splitId: splitId || null,
          allowTip,
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
      });
      toast("Payment recorded", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not record payment", "error");
    } finally {
      setBusy(null);
    }
  };

  const saveSplits = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const payload = allocations
      .filter((allocation) => allocation.label.trim() && Number(allocation.amount) > 0)
      .map((allocation) => ({
        label: allocation.label.trim(),
        amountCents: Math.round(Number(allocation.amount) * 100),
      }));
    setBusy("split");
    try {
      await apiFetch("/api/billing/splits", {
        method: "POST",
        body: JSON.stringify({
          restaurantId,
          billToken: selected.token,
          type: splitType,
          label: splitLabel,
          allocations: payload,
        }),
      });
      toast("Splits saved", "success");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save splits", "error");
    } finally {
      setBusy(null);
    }
  };

  if (bills.length === 0) return <p className="text-sm text-slate-500">No bills yet.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
      <Card className="h-fit">
        <CardHeader><CardTitle>Bills</CardTitle></CardHeader>
        <CardContent className="space-y-2 p-3">
          {bills.map((bill) => (
            <button
              key={bill.id}
              type="button"
              onClick={() => setSelectedId(bill.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                bill.id === selectedId ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">Table {bill.tableNumber}</span>
                <Badge variant={bill.status === "PAID" ? "success" : bill.status === "PARTIALLY_PAID" ? "info" : "warning"}>
                  {bill.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{bill.branchName}</p>
              <p className="mt-1 text-xs text-slate-600">{money(bill.totalCents, currency)} total</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {selected ? (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Table {selected.tableNumber} summary</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold">{money(selected.totalCents, currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{money(selected.paidCents, currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tip</span><span>{money(selected.tipCents, currency)}</span></div>
              <div className="flex justify-between text-base font-bold"><span>Outstanding</span><span>{money(outstandingCents, currency)}</span></div>
            </CardContent>
          </Card>

          {canManage && outstandingCents > 0 ? (
            <Card>
              <CardHeader><CardTitle>Record payment</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={recordPayment} className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Amount ({currency})</Label>
                    <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                  </div>
                  <div>
                    <Label>Method</Label>
                    <Select value={method} onChange={(event) => setMethod(event.target.value as "CASH" | "ONLINE")}>
                      <option value="CASH">Cash</option>
                      <option value="ONLINE">Online (recorded manually)</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Split (optional)</Label>
                    <Select value={splitId} onChange={(event) => setSplitId(event.target.value)}>
                      <option value="">Whole bill</option>
                      {selected.splits.map((split) => (
                        <option key={split.id} value={split.id}>
                          {split.label} - {money(split.assignedCents - split.paidCents, currency)} left
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={allowTip} onChange={(event) => setAllowTip(event.target.checked)} className="h-4 w-4" />
                      Allow excess as tip
                    </label>
                  </div>
                  <Button type="submit" disabled={busy !== null} className="sm:col-span-2">
                    {busy === "payment" ? "Saving..." : "Record payment"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canManage && selected.payments.length === 0 ? (
            <Card>
              <CardHeader><CardTitle>Set up splits</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={saveSplits} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Split type</Label>
                      <Select value={splitType} onChange={(event) => setSplitType(event.target.value as (typeof SPLIT_TYPES)[number])}>
                        {SPLIT_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Label</Label>
                      <Input value={splitLabel} onChange={(event) => setSplitLabel(event.target.value)} />
                    </div>
                  </div>
                  {splitType === "EQUAL" || splitType === "ITEMS" || splitType === "CUSTOM" ? (
                    <div className="space-y-2">
                      {allocations.map((allocation, index) => (
                        <div key={index} className="grid grid-cols-[1fr,140px,auto] gap-2">
                          <Input
                            value={allocation.label}
                            onChange={(event) => setAllocations((current) => current.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))}
                            placeholder="Guest name"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={allocation.amount}
                            onChange={(event) => setAllocations((current) => current.map((entry, position) => position === index ? { ...entry, amount: event.target.value } : entry))}
                            placeholder="Amount"
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setAllocations((current) => current.filter((_, position) => position !== index))} aria-label="Remove split">-</Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => setAllocations((current) => [...current, { label: `Guest ${current.length + 1}`, amount: "0" }])}>
                        Add guest
                      </Button>
                    </div>
                  ) : null}
                  <Button type="submit" disabled={busy !== null}>{busy === "split" ? "Saving..." : "Save splits"}</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {selected.splits.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Splits</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selected.splits.map((split) => (
                  <div key={split.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">{split.label}</p>
                      <p className="text-xs text-slate-500">{split.type.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{money(split.assignedCents, currency)}</p>
                      <p className="text-xs text-slate-500">{money(split.paidCents, currency)} paid</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {selected.payments.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Recent payments</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selected.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0">
                    <span className="text-slate-600">{payment.method.replace(/_/g, " ")} - {new Date(payment.createdAt).toLocaleString()}</span>
                    <span className="font-semibold">{money(payment.amountCents, currency)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
