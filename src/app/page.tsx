import Link from "next/link";
import Image from "next/image";
import { QrCode, ChefHat, BarChart3, CreditCard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="DineDesk logo" width={36} height={36} unoptimized className="h-9 w-9 rounded-xl object-cover" />
          <span className="text-lg font-extrabold tracking-tight">DineDesk</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Sign in</Link>
          <Link href="/register"><Button size="sm">Get started</Button></Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">Multi-restaurant SaaS</p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Run QR ordering, kitchen, billing, and analytics from one place.</h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">DineDesk helps restaurants manage dine-in orders from table QR codes to kitchen stations, split payments, and performance insights.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register"><Button size="lg">Start free trial <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/login"><Button size="lg" variant="outline">Open dashboard</Button></Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">Demo: <code className="rounded bg-slate-100 px-1.5 py-0.5">owner@pizzahouse.test</code> / <code className="rounded bg-slate-100 px-1.5 py-0.5">demo123</code></p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-orange-50 via-white to-slate-50 p-6 shadow-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: QrCode, title: "QR ordering", desc: "Guests scan, browse, and order from the table." },
                { icon: ChefHat, title: "Kitchen flow", desc: "Real-time tickets by station and status." },
                { icon: CreditCard, title: "Split billing", desc: "Cash, online, equal or custom splits." },
                { icon: BarChart3, title: "Analytics", desc: "Sales, best sellers, occupancy and staff." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <item.icon className="h-5 w-5 text-orange-600" />
                  <h3 className="mt-3 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
