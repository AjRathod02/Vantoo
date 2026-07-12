import {
  LayoutDashboard,
  Users,
  Store,
  Bike,
  Package,
  ShoppingBag,
  MapPin,
  RotateCcw,
  CreditCard,
  Headphones,
  Bell,
  BarChart3,
  Settings,
  Shield,
  Gift,
  Star,
  Tags,
  Ticket,
  Megaphone,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_MODULES } from "@/lib/admin/types";

/** Icon keyed by href (more reliable than resource, which can repeat). */
export const ADMIN_NAV_ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/customers": Users,
  "/admin/vendors": Store,
  "/admin/riders": Bike,
  "/admin/products": Package,
  "/admin/categories": Tags,
  "/admin/coupons": Ticket,
  "/admin/help": LifeBuoy,
  "/admin/orders": ShoppingBag,
  "/admin/tracking": MapPin,
  "/admin/refunds": RotateCcw,
  "/admin/payments": CreditCard,
  "/admin/referrals": Gift,
  "/admin/sponsorships": Megaphone,
  "/admin/complaints": Headphones,
  "/admin/reviews": Star,
  "/admin/notifications": Bell,
  "/admin/reports": BarChart3,
  "/admin/settings": Settings,
  "/admin/audit-logs": Shield,
};

export type AdminNavItem = {
  resource: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export function getAdminNavItems(allowedResources?: string[]): AdminNavItem[] {
  return ADMIN_MODULES.filter(
    (m) => !allowedResources || allowedResources.includes(m.resource)
  ).map((m) => ({
    ...m,
    icon: ADMIN_NAV_ICONS[m.href] ?? LayoutDashboard,
  }));
}

/** Primary destinations for mobile bottom navigation. */
export const ADMIN_BOTTOM_NAV_HREFS = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/customers",
  "/admin/tracking",
] as const;

export function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: "Admin", href: "/admin" },
  ];

  if (pathname === "/admin") {
    crumbs.push({ label: "Dashboard" });
    return crumbs;
  }

  const match = ADMIN_MODULES.find(
    (m) => pathname === m.href || (m.href !== "/admin" && pathname.startsWith(m.href))
  );

  if (match) {
    crumbs.push({ label: match.label, href: match.href });
  }

  // Detail / nested segments
  const parts = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    const pretty = last
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (!match || pretty.toLowerCase() !== match.label.toLowerCase()) {
      crumbs.push({ label: pretty });
    }
  }

  return crumbs;
}

export function isNavActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}
