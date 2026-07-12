"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toast";

interface CancellationPolicy {
  id: string;
  user_type: string;
  free_cancellation_minutes: number;
  cancellation_charge_percent: number;
  refund_percent: number;
  penalty_amount: number;
}

const FIELD =
  "mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-base sm:text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20";

const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "delivery", label: "Delivery" },
  { id: "payments", label: "Payments" },
  { id: "notifications", label: "Notifications" },
  { id: "referrals", label: "Referrals" },
  { id: "sponsorships", label: "Sponsorships" },
] as const;

export default function AdminSettingsPage() {
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]["id"]>("delivery");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setPolicies(d.settings?.cancellationPolicies ?? []))
      .finally(() => setLoading(false));
  }, []);

  const savePolicy = async (policy: CancellationPolicy) => {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cancellationPolicy: {
          userType: policy.user_type,
          freeCancellationMinutes: policy.free_cancellation_minutes,
          cancellationChargePercent: policy.cancellation_charge_percent,
          refundPercent: policy.refund_percent,
          penaltyAmount: policy.penalty_amount,
        },
      }),
    });
    if (res.ok) {
      toast.success("Policy updated");
    } else {
      toast.error("Update failed");
    }
  };

  return (
    <AdminPageShell
      title="Settings"
      subtitle="Platform configuration across general, delivery, payments, and more"
    >
      <div className="space-y-6">
        <div
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
          role="tablist"
          aria-label="Settings sections"
        >
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                tab === t.id
                  ? "bg-brand-primary text-white"
                  : "bg-white text-ink-muted ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "delivery" && (
          <section aria-label="Cancellation policies">
            <h2 className="mb-4 text-lg font-semibold text-ink">Cancellation Policies</h2>
            {loading ? (
              <p className="text-ink-muted">Loading...</p>
            ) : (
              <div className="space-y-4">
                {policies.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5"
                  >
                    <h3 className="mb-3 font-medium capitalize text-ink">{p.user_type}</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-sm">
                        <span className="text-ink-muted">Free cancellation (min)</span>
                        <input
                          type="number"
                          value={p.free_cancellation_minutes}
                          onChange={(e) =>
                            setPolicies((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? { ...x, free_cancellation_minutes: +e.target.value }
                                  : x
                              )
                            )
                          }
                          className={FIELD}
                        />
                      </label>
                      <label className="text-sm">
                        <span className="text-ink-muted">Charge %</span>
                        <input
                          type="number"
                          value={p.cancellation_charge_percent}
                          onChange={(e) =>
                            setPolicies((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? { ...x, cancellation_charge_percent: +e.target.value }
                                  : x
                              )
                            )
                          }
                          className={FIELD}
                        />
                      </label>
                      <label className="text-sm">
                        <span className="text-ink-muted">Refund %</span>
                        <input
                          type="number"
                          value={p.refund_percent}
                          onChange={(e) =>
                            setPolicies((prev) =>
                              prev.map((x) =>
                                x.id === p.id ? { ...x, refund_percent: +e.target.value } : x
                              )
                            )
                          }
                          className={FIELD}
                        />
                      </label>
                      <label className="text-sm">
                        <span className="text-ink-muted">Penalty (₹)</span>
                        <input
                          type="number"
                          value={p.penalty_amount}
                          onChange={(e) =>
                            setPolicies((prev) =>
                              prev.map((x) =>
                                x.id === p.id ? { ...x, penalty_amount: +e.target.value } : x
                              )
                            )
                          }
                          className={FIELD}
                        />
                      </label>
                    </div>
                    <Button
                      size="md"
                      className="mt-4 min-h-11 w-full sm:w-auto"
                      onClick={() => savePolicy(p)}
                    >
                      Save Policy
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab !== "delivery" && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <h2 className="mb-2 text-lg font-semibold capitalize text-ink">{tab} settings</h2>
            <p className="text-sm text-ink-muted">
              Configure {tab} options from the related module pages, or extend this panel when
              additional {tab} keys are available from the settings API.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tab === "payments" && (
                <Link
                  href="/admin/payments"
                  className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-5 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary"
                >
                  Open Payments
                </Link>
              )}
              {tab === "notifications" && (
                <Link
                  href="/admin/notifications"
                  className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-5 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary"
                >
                  Open Notifications
                </Link>
              )}
              {tab === "referrals" && (
                <Link
                  href="/admin/referrals"
                  className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-5 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary"
                >
                  Open Referrals
                </Link>
              )}
              {tab === "sponsorships" && (
                <Link
                  href="/admin/sponsorships"
                  className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-5 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary"
                >
                  Open Sponsorships
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
