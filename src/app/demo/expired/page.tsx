import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DemoExpiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Demo access expired</h1>
        <p className="text-sm text-slate-600">Your 12-hour demo session has ended. Request a new demo to continue exploring DineDesk.</p>
        <div className="flex justify-center gap-3">
          <Link href="/demo/request"><Button>Request new demo</Button></Link>
          <Link href="/login"><Button variant="outline">Sign in</Button></Link>
        </div>
      </div>
    </main>
  );
}
