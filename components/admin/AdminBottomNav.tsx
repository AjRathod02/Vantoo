"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useAdminShell } from "@/components/admin/AdminShellContext";
import {
  ADMIN_BOTTOM_NAV_HREFS,
  getAdminNavItems,
  isNavActive,
} from "@/components/admin/adminNav";
import { cn } from "@/lib/utils";

export function AdminBottomNav() {
  const pathname = usePathname();
  const { openMobileNav, allowedResources } = useAdminShell();
  const all = getAdminNavItems(allowedResources);
  const primary = ADMIN_BOTTOM_NAV_HREFS.map((href) =>
    all.find((item) => item.href === href)
  ).filter(Boolean) as ReturnType<typeof getAdminNavItems>;

  if (primary.length === 0) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:hidden"
      aria-label="Primary admin modules"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary",
                  active ? "text-brand-primary" : "text-ink-muted"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={openMobileNav}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
            aria-label="More modules"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
