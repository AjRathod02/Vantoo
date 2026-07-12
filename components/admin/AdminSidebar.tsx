"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/stores/toast";
import { useAdminShell } from "@/components/admin/AdminShellContext";
import {
  getAdminNavItems,
  isNavActive,
} from "@/components/admin/adminNav";

function NavLinks({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { allowedResources } = useAdminShell();
  const links = getAdminNavItems(allowedResources);

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-3" aria-label="Admin">
      {links.map(({ href, label, icon: Icon }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
              active
                ? "bg-brand-primary text-white shadow-sm"
                : "text-ink-muted hover:bg-gray-50 hover:text-ink"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand({
  collapsed,
  onToggleCollapse,
  showClose,
  onClose,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showClose?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-4">
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
            Vantoo
          </p>
          <p className="truncate text-sm font-bold text-ink">Admin Portal</p>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  const { adminName, adminRole } = useAdminShell();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/admin/login");
    router.refresh();
  };

  if (collapsed) {
    return (
      <div className="border-t border-gray-100 p-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center justify-center rounded-xl text-ink-muted hover:bg-gray-50 hover:text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 p-4">
      <p className="truncate text-sm font-medium text-ink">{adminName}</p>
      <p className="truncate text-xs capitalize text-ink-muted">
        {adminRole.replace(/_/g, " ")}
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-medium text-ink-muted transition-colors hover:border-brand-secondary hover:text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}

/** Desktop / tablet persistent sidebar (hidden below lg). */
export function AdminSidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useAdminShell();

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 lg:flex",
        sidebarCollapsed ? "w-[4.5rem]" : "w-64"
      )}
      aria-label="Admin sidebar"
    >
      <SidebarBrand
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />
      <NavLinks collapsed={sidebarCollapsed} />
      <SidebarFooter collapsed={sidebarCollapsed} />
    </aside>
  );
}

/** Mobile / tablet slide-out navigation drawer. */
export function AdminMobileDrawer() {
  const { mobileNavOpen, closeMobileNav } = useAdminShell();

  return (
    <div
      className={cn("lg:hidden", mobileNavOpen ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!mobileNavOpen}
    >
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-200",
          mobileNavOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={closeMobileNav}
        aria-hidden
      />
      <aside
        id="admin-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,88vw)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarBrand showClose onClose={closeMobileNav} />
        <NavLinks onNavigate={closeMobileNav} />
        <SidebarFooter />
      </aside>
    </div>
  );
}
