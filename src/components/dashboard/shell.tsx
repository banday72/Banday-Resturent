"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Menu as MenuIcon,
  QrCode,
  Settings,
  Store,
  Users,
  UtensilsCrossed,
  X,
  Crown,
  Bell,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RestaurantOption = { id: string; name: string; slug: string; logoUrl: string | null };
type SubscriptionBadge = {
  status: string;
  planName: string | null;
  daysRemaining: number | null;
  expired: boolean;
  trialing: boolean;
};

const navItems = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/orders", label: "Orders", icon: ClipboardList },
  { href: "/app/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/app/waiter", label: "Waiter", icon: UtensilsCrossed },
  { href: "/app/tables", label: "Tables & QR", icon: QrCode },
  { href: "/app/menu", label: "Menu", icon: MenuIcon },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/employees", label: "Staff", icon: Users },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({
  children,
  userName,
  role,
  restaurants,
  activeRestaurantId,
  isSuperAdmin,
  subscription,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
  restaurants: RestaurantOption[];
  activeRestaurantId: string;
  isSuperAdmin: boolean;
  subscription?: SubscriptionBadge;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const activeRestaurant = restaurants.find((item) => item.id === activeRestaurantId) ?? restaurants[0];

  const hrefWithRestaurant = (href: string) => `${href}?restaurant=${activeRestaurantId}`;

  const switchRestaurant = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("restaurant", id);
    router.push(`${pathname}?${params.toString()}`);
    setProfileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen ? <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-100 px-5">
          <Link href="/app" className="flex items-center gap-2">
            <Image src="/logo.png" alt="DineDesk logo" width={36} height={36} unoptimized className="h-9 w-9 rounded-xl object-cover shadow-sm" />
            <span className="text-lg font-extrabold tracking-tight text-slate-900">DineDesk</span>
          </Link>
          <button type="button" className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 py-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Workspace</label>
          <div className="relative">
            <select
              value={activeRestaurantId}
              onChange={(event) => switchRestaurant(event.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold text-slate-800 outline-none focus:border-orange-400"
            >
              {restaurants.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-3 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={hrefWithRestaurant(item.href)}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-orange-50 text-orange-700" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
          {isSuperAdmin ? (
            <div className="pt-4">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Platform</p>
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  pathname.startsWith("/admin") ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Crown className="h-4.5 w-4.5" />
                Super Admin
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="rounded-xl bg-slate-900 p-3 text-white">
            <p className="text-xs font-semibold">Need a hand?</p>
            <p className="mt-1 text-[11px] text-slate-300">Check the docs or contact support.</p>
            <Link href="/docs" className="mt-2 inline-block text-[11px] font-semibold text-orange-300 hover:text-orange-200">
              View documentation →
            </Link>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{activeRestaurant?.name ?? "Restaurant"}</p>
              <p className="text-sm font-semibold text-slate-800">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/app/notifications?restaurant=${activeRestaurantId}`} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500" />
            </Link>
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                  {userName.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden text-sm font-semibold text-slate-700 sm:block">{userName}</span>
              </button>
              {profileOpen ? (
                <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="border-b border-slate-100 px-2 py-2 text-xs text-slate-500">{role}</div>
                  <form action="/api/auth/signout" method="post" className="pt-1">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {subscription ? (
          <div className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs sm:px-6",
            subscription.expired ? "bg-red-50 text-red-700" : subscription.trialing ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700",
          )}>
            <span className="font-medium">
              {subscription.expired
                ? "Subscription expired — ordering is paused. Please renew in Settings."
                : subscription.trialing
                  ? `Free trial: ${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? "" : "s"} left.`
                  : `${subscription.planName ?? "Your plan"} is active.`}
            </span>
            <Link href={hrefWithRestaurant("/app/settings")} className="font-semibold underline underline-offset-2">
              Manage subscription
            </Link>
          </div>
        ) : null}
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
