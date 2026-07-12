"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { StatCard } from "@/components/admin/StatCard";
import { AdminCardSkeleton } from "@/components/admin/AdminTableSkeleton";
import { IndianRupee, CreditCard, AlertTriangle, TrendingUp } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface PaymentSummary {
  totalRevenue: number;
  totalTransactions: number;
  failedPayments: number;
  pendingPayouts: number;
  vendorEarnings: number;
  riderEarnings: number;
  commissionRevenue: number;
}

export default function AdminPaymentsPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [byMethod, setByMethod] = useState<{ method: string; count: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/payments")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setByMethod(d.byMethod ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminPageShell title="Payments" subtitle="Revenue, payouts, and transaction management">
      {loading ? (
        <AdminCardSkeleton count={4} />
      ) : summary ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Revenue" value={formatINR(summary.totalRevenue)} icon={IndianRupee} />
            <StatCard label="Transactions" value={summary.totalTransactions} icon={CreditCard} />
            <StatCard label="Failed Payments" value={summary.failedPayments} icon={AlertTriangle} />
            <StatCard label="Pending Payouts" value={summary.pendingPayouts} icon={TrendingUp} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Vendor Earnings" value={formatINR(summary.vendorEarnings)} icon={IndianRupee} />
            <StatCard label="Rider Earnings" value={formatINR(summary.riderEarnings)} icon={IndianRupee} />
            <StatCard label="Commission" value={formatINR(summary.commissionRevenue)} icon={TrendingUp} />
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
            <h3 className="mb-4 font-semibold text-ink">Payment Methods</h3>
            <div className="space-y-2">
              {byMethod.map((m) => (
                <div
                  key={m.method}
                  className="flex flex-col gap-1 rounded-xl bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium uppercase text-ink">{m.method}</span>
                  <span className="text-sm text-ink-muted">
                    {m.count} txns · {formatINR(m.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
