"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBreadcrumbs } from "@/components/admin/adminNav";
import { cn } from "@/lib/utils";

export function AdminBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-ink-soft" aria-hidden />
              )}
              <li className="min-w-0">
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="truncate hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn("truncate", isLast && "font-medium text-ink")}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
