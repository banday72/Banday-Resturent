"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetcher";

export type DemoRequestRow = {
  id: string;
  email: string;
  restaurantName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  accessExpiresAt: string | null;
  createdAt: string;
  approvedByEmail: string | null;
};

const variants = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
} as const;

export function DemoRequestsPanel({ requests }: { requests: DemoRequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    setError("");
    try {
      await apiFetch("/api/admin/demo-requests", {
        method: "POST",
        body: JSON.stringify({ requestId: id, action }),
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update demo request");
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) return <p className="text-sm text-slate-500">No demo requests yet.</p>;

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {requests.map((item) => (
        <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{item.restaurantName || "Demo request"}</p>
              <Badge variant={variants[item.status]}>{item.status.toLowerCase()}</Badge>
            </div>
            <p className="text-xs text-slate-500">{item.email}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Requested {new Date(item.createdAt).toLocaleString()}
              {item.accessExpiresAt ? ` · Access until ${new Date(item.accessExpiresAt).toLocaleString()}` : ""}
            </p>
          </div>
          {item.status === "PENDING" ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busyId === item.id} onClick={() => act(item.id, "reject")}>Reject</Button>
              <Button size="sm" disabled={busyId === item.id} onClick={() => act(item.id, "approve")}>Approve</Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
