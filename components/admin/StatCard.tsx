import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition-shadow hover:shadow-cardHover sm:p-5",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
        <span className="text-xs text-ink-muted sm:text-sm">{label}</span>
        <div className="shrink-0 rounded-xl bg-brand-surface p-2" aria-hidden>
          <Icon className="h-4 w-4 text-brand-primary" />
        </div>
      </div>
      <p className="truncate text-xl font-bold text-ink sm:text-2xl">{value}</p>
      {trend && (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            trendUp ? "text-brand-accent" : "text-brand-secondary"
          )}
        >
          {trend}
        </p>
      )}
    </div>
  );
}
