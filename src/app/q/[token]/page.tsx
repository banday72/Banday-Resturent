"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function QrEntryPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  useEffect(() => {
    const token = params.token;
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/public/q/${token}`);
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Invalid QR code");
        const data = json.data;
        localStorage.setItem(`guest:${token}`, data.guest.token);
        localStorage.setItem(`guestctx:${data.guest.token}`, JSON.stringify(data));
        router.replace(`/menu/${token}`);
      } catch {
        router.replace("/?qr=invalid");
      }
    })();
  }, [params.token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
        <p className="text-sm font-medium">Opening your table menu…</p>
      </div>
    </div>
  );
}
