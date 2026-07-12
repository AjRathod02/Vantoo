"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

interface AdminFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  placeholder?: string;
  filters?: {
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  sort?: {
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  };
  rightSlot?: React.ReactNode;
  className?: string;
}

export function AdminFilterBar({
  search,
  onSearchChange,
  onSearchSubmit,
  placeholder = "Search…",
  filters = [],
  sort,
  rightSlot,
  className,
}: AdminFilterBarProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit?.();
        }}
      >
        <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-base text-ink placeholder:text-ink-soft focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 sm:text-sm"
            aria-label={placeholder}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {sort && (
            <select
              value={sort.value}
              onChange={(e) => sort.onChange(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-ink sm:flex-none"
              aria-label="Sort"
            >
              {sort.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {onSearchSubmit && (
            <Button type="submit" size="md" className="min-h-11 flex-1 sm:flex-none">
              Search
            </Button>
          )}
          {rightSlot}
        </div>
      </form>

      {filters.length > 0 && (
        <div className="space-y-3">
          {filters.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                {f.label}
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
                {f.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => f.onChange(o.value)}
                    className={cn(
                      "min-h-11 shrink-0 rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                      f.value === o.value
                        ? "bg-brand-primary text-white"
                        : "bg-gray-100 text-ink-muted hover:bg-gray-200"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
