"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/fetcher";

export default function DemoRequestPage() {
  const [form, setForm] = useState({ email: "", restaurantName: "" });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/demo/requests", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit demo request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-slate-900">DineDesk</Link>
          <p className="mt-2 text-sm text-slate-600">Request a guided 12-hour demo workspace.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Request demo access</CardTitle></CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-3 text-sm text-slate-600">
                <p className="font-medium text-emerald-700">Request received.</p>
                <p>Super admin will review it and send a one-time code to your email. After verification you will get 12 hours of demo access.</p>
                <Link href="/login" className="inline-block font-semibold text-orange-600 hover:text-orange-700">Back to sign in →</Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Work email</Label>
                  <Input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@restaurant.com" />
                </div>
                <div>
                  <Label>Restaurant name (optional)</Label>
                  <Input value={form.restaurantName} onChange={(event) => setForm({ ...form, restaurantName: event.target.value })} placeholder="Your restaurant" />
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit demo request"}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
