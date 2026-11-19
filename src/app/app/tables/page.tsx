"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { apiFetch, withRestaurant } from "@/lib/fetcher";
import { useToast } from "@/components/ui/toast";

type Table = { id: string; number: string; seats: number; section: string | null; status: string; branchId: string; branch: { id: string; name: string }; qrCode: { token: string; url: string } | null };
type Branch = { id: string; name: string };

export default function TablesPage() {
  const search = useSearchParams();
  const restaurantId = search.get("restaurant") || "";
  const { toast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ branchId: "", number: "", seats: 4, section: "" });

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const [t, b] = await Promise.all([
      apiFetch<Table[]>(withRestaurant("/api/tables", restaurantId)),
      apiFetch<Branch[]>(withRestaurant("/api/branches", restaurantId)),
    ]);
    setTables(t); setBranches(b);
    if (!form.branchId && b[0]) setForm((f) => ({ ...f, branchId: b[0].id }));
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/tables", { method: "POST", body: JSON.stringify({ restaurantId, branchId: form.branchId, number: form.number, seats: form.seats, section: form.section || undefined }) });
      toast("Table created", "success");
      setOpen(false);
      setForm({ branchId: branches[0]?.id ?? "", number: "", seats: 4, section: "" });
      load();
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "");

  return (
    <div className="space-y-4">
      <PageHeader title="Tables & QR codes" description="Manage floor tables and QR links." actions={<Button onClick={() => setOpen(true)}>Add table</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => (
          <Card key={table.id}>
            <CardContent className="p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-900">Table {table.number}</p>
                  <p className="text-xs text-slate-500">{table.branch.name}{table.section ? ` · ${table.section}` : ""} · {table.seats} seats</p>
                </div>
                <Badge variant={table.status === "AVAILABLE" ? "success" : table.status === "BILL_REQUESTED" ? "warning" : "info"}>{table.status.replace(/_/g, " ")}</Badge>
              </div>
              {table.qrCode ? (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 break-all">
                  <p className="mb-1 font-semibold text-slate-700">QR URL</p>
                  <a href={`${origin}/q/${table.qrCode.token}`} target="_blank" rel="noreferrer" className="text-orange-600 hover:underline">{origin}/q/{table.qrCode.token}</a>
                </div>
              ) : <p className="mt-3 text-xs text-slate-400">No QR assigned</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add table">
        <form onSubmit={create} className="space-y-3">
          <div><Label>Branch</Label><Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} required>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
          <div><Label>Table number/name</Label><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required placeholder="e.g. 12 or A1" /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Seats</Label><Input type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} /></div><div><Label>Section</Label><Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="Main Hall" /></div></div>
          <Button type="submit" className="w-full">Create table & QR</Button>
        </form>
      </Modal>
    </div>
  );
}
