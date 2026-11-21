"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/fetcher";

type VerifyResult = { email: string; password: string; accessExpiresAt: string };

function DemoVerifyForm() {
  const search = useSearchParams();
  const router = useRouter();
  const requestId = search.get("request") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestId) {
      setError("Missing demo request. Open the link from your approval email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<VerifyResult>("/api/demo/verify", {
        method: "POST",
        body: JSON.stringify({ requestId, code }),
      });
      const session = await signIn("credentials", {
        redirect: false,
        email: result.email,
        password: result.password,
      });
      if (session?.error) throw new Error("Could not start the demo session");
      router.push("/app");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify demo code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-slate-900">DineDesk</Link>
          <p className="mt-2 text-sm text-slate-600">Enter the one-time code sent to your email.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Verify demo code</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>One-time code</Label>
                <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Verifying…" : "Start 12-hour demo"}</Button>
            </form>
            <p className="mt-4 text-xs text-slate-500">Need a new code? Ask super admin to resend it.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function DemoVerifyPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading…</main>}>
      <DemoVerifyForm />
    </Suspense>
  );
}
