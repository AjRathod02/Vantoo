"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/stores/toast";
import { useAdminShell } from "@/components/admin/AdminShellContext";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { cn } from "@/lib/utils";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, actions }: AdminHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { openMobileNav, mobileNavOpen, adminName, adminRole } = useAdminShell();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={openMobileNav}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-gray-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary lg:hidden"
          aria-label="Open navigation menu"
          aria-controls="admin-mobile-nav"
          aria-expanded={mobileNavOpen}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <AdminBreadcrumbs className="mb-0.5 hidden sm:block" />
          <h1 className="truncate text-base font-bold text-ink sm:text-lg">{title}</h1>
          {subtitle && (
            <p className="hidden truncate text-xs text-ink-muted sm:block">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {actions && <div className="hidden items-center gap-2 md:flex">{actions}</div>}

          <Link
            href="/admin/notifications"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-muted hover:bg-gray-50 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Link>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-2.5 text-sm font-medium text-ink-muted hover:border-brand-primary hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:px-3"
              aria-label="User profile menu"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-surface text-brand-primary">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden max-w-[8rem] truncate lg:inline">{adminName}</span>
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg animate-fade-in"
              >
                <div className="border-b border-gray-50 px-3 py-2">
                  <p className="truncate text-sm font-medium text-ink">{adminName}</p>
                  <p className="truncate text-xs capitalize text-ink-muted">
                    {adminRole.replace(/_/g, " ")}
                  </p>
                </div>
                <Link
                  role="menuitem"
                  href="/admin/settings"
                  onClick={() => setProfileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-ink hover:bg-gray-50"
                >
                  Settings
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-brand-secondary hover:bg-red-50"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex gap-2 overflow-x-auto border-t border-gray-50 px-4 py-2 no-scrollbar md:hidden">
          {actions}
        </div>
      )}
    </header>
  );
}
