"use client";

import { AdminHeader } from "@/components/admin/AdminHeader";

interface AdminPageShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the scrollable content area */
  contentClassName?: string;
  /** Remove default padding (e.g. full-bleed live tracking) */
  flush?: boolean;
}

/** Consistent admin page layout with header and padded content. */
export function AdminPageShell({
  title,
  subtitle,
  actions,
  children,
  contentClassName,
  flush,
}: AdminPageShellProps) {
  return (
    <>
      <AdminHeader title={title} subtitle={subtitle} actions={actions} />
      <div
        className={
          flush
            ? `flex min-h-0 flex-1 flex-col overflow-y-auto pb-20 lg:pb-0 ${contentClassName ?? ""}`
            : `flex-1 overflow-y-auto px-4 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8 ${contentClassName ?? ""}`
        }
      >
        {children}
      </div>
    </>
  );
}
