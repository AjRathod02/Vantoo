"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type AdminShellContextValue = {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebarCollapsed: () => void;
  adminName: string;
  adminRole: string;
  allowedResources?: string[];
};

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function AdminShellProvider({
  children,
  adminName,
  adminRole,
  allowedResources,
}: {
  children: React.ReactNode;
  adminName: string;
  adminRole: string;
  allowedResources?: string[];
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);
  const toggleSidebarCollapsed = useCallback(
    () => setSidebarCollapsed((v) => !v),
    []
  );

  // Close drawer on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const value = useMemo(
    () => ({
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
      toggleMobileNav,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      adminName,
      adminRole,
      allowedResources,
    }),
    [
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
      toggleMobileNav,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      adminName,
      adminRole,
      allowedResources,
    ]
  );

  return (
    <AdminShellContext.Provider value={value}>{children}</AdminShellContext.Provider>
  );
}

export function useAdminShell() {
  const ctx = useContext(AdminShellContext);
  if (!ctx) {
    throw new Error("useAdminShell must be used within AdminShellProvider");
  }
  return ctx;
}
