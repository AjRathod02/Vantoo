"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { ChartCard } from "@/components/admin/ChartCard";
import { Button } from "@/components/ui/Button";
import type { ChartDataPoint } from "@/lib/admin/types";
import {
  exportCsv,
  exportExcel,
  exportPdf,
  tableHtmlFromRows,
  type ExportColumn,
} from "@/lib/admin/export";
import { toast } from "@/lib/stores/toast";

const REPORT_TYPES = [
  { id: "orders", label: "Orders" },
  { id: "customers", label: "Customers" },
  { id: "vendors", label: "Vendors" },
  { id: "riders", label: "Riders" },
  { id: "products", label: "Products" },
  { id: "payments", label: "Payments" },
  { id: "refunds", label: "Refunds" },
  { id: "reviews", label: "Reviews" },
  { id: "complaints", label: "Complaints" },
  { id: "revenue", label: "Revenue" },
  { id: "inventory", label: "Inventory" },
  { id: "delivery", label: "Delivery" },
  { id: "cancellations", label: "Cancellations" },
  { id: "geographic", label: "Geographic" },
];

const PERIODS = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "custom", label: "Custom range" },
];

type ReportRow = Record<string, string | number | boolean | null>;

export default function AdminReportsPage() {
  const [type, setType] = useState("revenue");
  const [period, setPeriod] = useState("weekly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleCadence, setScheduleCadence] = useState("weekly");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type, period });
    if (period === "custom" && dateFrom) params.set("from", dateFrom);
    if (period === "custom" && dateTo) params.set("to", dateTo);

    fetch(`/api/admin/reports?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setReport(d.report);
        setRows((d.rows as ReportRow[]) ?? []);
      })
      .catch(() => toast.error("Failed to load report"))
      .finally(() => setLoading(false));
  }, [type, period, dateFrom, dateTo]);

  const chart = (report?.chart as ChartDataPoint[]) ?? [];

  const columns: ExportColumn<ReportRow>[] = useMemo(() => {
    if (rows.length === 0) {
      return [
        { key: "key", label: "Metric" },
        { key: "value", label: "Value" },
      ];
    }
    return Object.keys(rows[0]).map((k) => ({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
  }, [rows]);

  const exportRows = rows.length
    ? rows
    : report
      ? Object.entries(report)
          .filter(([k]) => k !== "chart" && k !== "stats")
          .map(([key, value]) => ({
            key,
            value:
              typeof value === "object" ? JSON.stringify(value) : (value as string | number | boolean | null),
          }))
      : [];

  const filename = `vantoo-${type}-${period}-${new Date().toISOString().slice(0, 10)}`;

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    if (exportRows.length === 0) {
      toast.error("No data to export");
      return;
    }
    try {
      if (format === "csv") exportCsv(exportRows, columns, filename);
      else if (format === "xlsx") exportExcel(exportRows, columns, filename);
      else
        exportPdf(
          `Vantoo ${type} report`,
          tableHtmlFromRows(exportRows, columns),
          filename
        );

      await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audit_export",
          reportType: type,
          format,
          period,
          from: dateFrom || null,
          to: dateTo || null,
          rowCount: exportRows.length,
        }),
      });
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  };

  const scheduleReport = async () => {
    if (!scheduleEmail) {
      toast.error("Enter an email for scheduled delivery");
      return;
    }
    const res = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule",
        reportType: type,
        format: "csv",
        cadence: scheduleCadence,
        emailTo: scheduleEmail,
      }),
    });
    if (res.ok) toast.success("Scheduled report saved");
    else toast.error("Could not schedule report");
  };

  return (
    <AdminPageShell
      title="Reports & Analytics"
      subtitle="Export PDF, Excel, or CSV · custom ranges · scheduled delivery"
    >
      <div className="space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="listbox" aria-label="Report type">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setType(r.id)}
              className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                type === r.id
                  ? "bg-brand-primary text-white"
                  : "border border-gray-200 bg-white text-ink-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm font-medium ${
                  period === p.id
                    ? "bg-ink text-white"
                    : "border border-gray-200 bg-white text-ink-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="flex-1 text-sm sm:flex-none">
                <span className="mb-1 block text-ink-muted">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 px-3"
                />
              </label>
              <label className="flex-1 text-sm sm:flex-none">
                <span className="mb-1 block text-ink-muted">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 px-3"
                />
              </label>
            </div>
          )}
        </div>

        {loading ? (
          <AdminTableSkeleton rows={4} cols={3} />
        ) : report ? (
          <div className="space-y-4">
            {chart.length > 0 && (
              <ChartCard
                title={`${type.charAt(0).toUpperCase() + type.slice(1)} Trend`}
                data={chart}
                valuePrefix={type === "revenue" || type === "payments" ? "₹" : ""}
              />
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
              <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
                <h3 className="font-semibold text-ink">Report data</h3>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  <Button
                    size="md"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => handleExport("csv")}
                  >
                    Export CSV
                  </Button>
                  <Button
                    size="md"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => handleExport("xlsx")}
                  >
                    Export Excel
                  </Button>
                  <Button
                    size="md"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => handleExport("pdf")}
                  >
                    Export PDF
                  </Button>
                </div>
              </div>
              {exportRows.length > 0 ? (
                <div className="max-h-96 overflow-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-ink-muted">
                      <tr>
                        {columns.map((c) => (
                          <th key={c.key as string} className="px-4 py-2 font-medium">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {exportRows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          {columns.map((c) => {
                            const key = String(c.key);
                            const value = (row as Record<string, unknown>)[key];
                            return (
                              <td key={key} className="px-4 py-2 text-ink-muted">
                                {value === null || value === undefined ? "" : String(value)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="max-h-96 overflow-auto p-4 text-xs text-ink-muted">
                  {JSON.stringify(report, null, 2)}
                </pre>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
              <h3 className="mb-3 font-semibold text-ink">Schedule report</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <input
                  type="email"
                  placeholder="Email delivery"
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-base sm:min-w-[220px] sm:text-sm"
                />
                <select
                  value={scheduleCadence}
                  onChange={(e) => setScheduleCadence(e.target.value)}
                  className="h-11 rounded-xl border border-gray-200 px-3 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <Button className="min-h-11 w-full sm:w-auto" onClick={scheduleReport}>
                  Schedule
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                Scheduled jobs are stored for the report service to pick up. Email delivery
                requires notification service configuration.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
