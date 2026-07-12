"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";

interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  resource: string;
  resource_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-logs?limit=100")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const columns: AdminColumn<AuditLog>[] = [
    {
      key: "time",
      label: "Time",
      mobilePrimary: true,
      sortable: true,
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => new Date(row.created_at).toLocaleString("en-IN"),
    },
    {
      key: "admin",
      label: "Admin",
      sortable: true,
      sortValue: (row) => row.admin_email,
      render: (row) => row.admin_email || "—",
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <span className="inline-flex rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium text-brand-primary">
          {row.action}
        </span>
      ),
    },
    {
      key: "resource",
      label: "Resource",
      render: (row) => (
        <span className="text-ink-muted">
          {row.resource}
          {row.resource_id ? ` #${row.resource_id}` : ""}
        </span>
      ),
    },
  ];

  return (
    <AdminPageShell title="Audit Logs" subtitle="Track all admin actions and changes">
      {loading ? (
        <AdminTableSkeleton rows={8} cols={4} />
      ) : (
        <AdminDataTable
          rows={logs}
          columns={columns}
          rowKey={(row) => row.id}
          emptyMessage="No audit logs yet."
          minWidth="720px"
          mobilePreviewKeys={["admin", "action"]}
        />
      )}
    </AdminPageShell>
  );
}
