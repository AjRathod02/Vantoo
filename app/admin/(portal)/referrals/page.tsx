"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatINR } from "@/lib/utils";
import { toast } from "@/lib/stores/toast";
import {
  Gift,
  IndianRupee,
  ToggleLeft,
  Users,
  Clock,
} from "lucide-react";
import type {
  AdminReferralAnalytics,
  AdminReferralTransaction,
  ReferralSettings,
} from "@/lib/referral/types";

export default function AdminReferralsPage() {
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [analytics, setAnalytics] = useState<AdminReferralAnalytics | null>(null);
  const [transactions, setTransactions] = useState<AdminReferralTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/referrals")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings ?? null);
        setAnalytics(d.analytics ?? null);
        setTransactions(d.transactions ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          isEnabled: settings.isEnabled,
          minOrderAmount: settings.minOrderAmount,
          commissionPercent: settings.commissionPercent,
        },
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      toast.success("Referral settings saved");
      load();
    } else {
      toast.error("Could not save settings");
    }
  };

  const updateReward = async (
    id: string,
    status: "completed" | "rejected"
  ) => {
    const res = await fetch("/api/admin/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reward: {
          id,
          status,
          rejectionReason: status === "rejected" ? "Rejected by admin" : undefined,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.transactions) setTransactions(data.transactions);
      toast.success(status === "completed" ? "Reward approved" : "Reward rejected");
      load();
    } else {
      toast.error("Update failed");
    }
  };

  return (
    <AdminPageShell
      title="Referrals"
      subtitle="Program settings, transactions, and analytics"
    >
      <div className="space-y-6">
        {loading || !settings || !analytics ? (
          <p className="text-ink-muted">Loading referrals...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Referrals"
                value={analytics.totalReferrals}
                icon={Users}
              />
              <StatCard
                label="Successful"
                value={analytics.successfulReferrals}
                icon={Gift}
              />
              <StatCard
                label="Pending Rewards"
                value={analytics.pendingRewards}
                icon={Clock}
              />
              <StatCard
                label="Commission Paid"
                value={formatINR(analytics.totalCommissionPaid)}
                icon={IndianRupee}
              />
            </div>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <ToggleLeft className="h-5 w-5 text-brand-primary" />
                <h2 className="text-lg font-semibold text-ink">Program Settings</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.isEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, isEnabled: e.target.checked })
                    }
                    className="h-5 w-5 rounded border-gray-300"
                  />
                  <span className="text-ink">Enable referral program</span>
                </label>
                <label className="text-sm">
                  <span className="text-ink-muted">Min order amount (₹)</span>
                  <input
                    type="number"
                    min={0}
                    value={settings.minOrderAmount}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        minOrderAmount: Number(e.target.value),
                      })
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-base sm:text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-ink-muted">Commission %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={settings.commissionPercent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        commissionPercent: Number(e.target.value),
                      })
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-base sm:text-sm"
                  />
                </label>
              </div>
              <Button className="mt-4 min-h-11 w-full sm:w-auto" onClick={saveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
              <h2 className="mb-4 text-lg font-semibold text-ink">
                Referral Transactions
              </h2>
              {transactions.length === 0 ? (
                <p className="text-sm text-ink-muted">No referral transactions yet.</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <ul className="space-y-3 md:hidden">
                    {transactions.map((t) => (
                      <li key={t.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-ink">{t.referrerName}</p>
                            <p className="text-sm text-ink-muted">→ {t.referredName}</p>
                          </div>
                          <Badge
                            tone={
                              t.status === "completed"
                                ? "green"
                                : t.status === "rejected"
                                  ? "red"
                                  : "orange"
                            }
                          >
                            {t.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-ink-muted">
                          {formatINR(t.orderAmount)} · commission {formatINR(t.commissionAmount)}
                        </p>
                        {t.status === "pending" && (
                          <div className="mt-3 flex flex-col gap-2">
                            <Button
                              size="md"
                              className="min-h-11 w-full"
                              onClick={() => updateReward(t.id, "completed")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="md"
                              variant="secondary"
                              className="min-h-11 w-full"
                              onClick={() => updateReward(t.id, "rejected")}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-ink-muted">
                          <th className="pb-2 font-medium">Referrer</th>
                          <th className="pb-2 font-medium">Friend</th>
                          <th className="pb-2 font-medium">Order</th>
                          <th className="pb-2 font-medium">Amount</th>
                          <th className="pb-2 font-medium">Commission</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id} className="border-b border-gray-50">
                            <td className="py-3 text-ink">{t.referrerName}</td>
                            <td className="py-3 text-ink">{t.referredName}</td>
                            <td className="py-3 font-mono text-xs text-ink-muted">
                              {t.orderId}
                            </td>
                            <td className="py-3">{formatINR(t.orderAmount)}</td>
                            <td className="py-3 font-medium">
                              {formatINR(t.commissionAmount)}
                              <span className="ml-1 text-xs text-ink-soft">
                                ({t.commissionPercent}%)
                              </span>
                            </td>
                            <td className="py-3">
                              <Badge
                                tone={
                                  t.status === "completed"
                                    ? "green"
                                    : t.status === "rejected"
                                      ? "red"
                                      : "orange"
                                }
                              >
                                {t.status}
                              </Badge>
                            </td>
                            <td className="py-3">
                              {t.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => updateReward(t.id, "completed")}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => updateReward(t.id, "rejected")}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </AdminPageShell>
  );
}
