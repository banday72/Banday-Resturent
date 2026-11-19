import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  primary: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
};

export function Badge({ variant = "default", className, children }: { variant?: keyof typeof variants; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", variants[variant], className)}>{children}</span>;
}
