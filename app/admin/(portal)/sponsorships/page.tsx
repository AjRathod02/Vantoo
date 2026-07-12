"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatINR } from "@/lib/utils";
import { toast } from "@/lib/stores/toast";

export default function AdminSponsorshipsPage() {
  const [packages, setPackages] = useState<
    Array<{
      id: string;
      name: string;
      price: number;
      duration_days: number;
      is_active: boolean;
    }>
  >([]);
  const [sponsorships, setSponsorships] = useState<
    Array<{
      id: string;
      restaurant_name: string;
      status: string;
      starts_at: string | null;
      ends_at: string | null;
      amount_paid: number;
    }>
  >([]);
  const [offers, setOffers] = useState<
    Array<{
      id: string;
      restaurant_name: string;
      badge_text: string;
      ends_at: string;
      is_active: boolean;
    }>
  >([]);

  const load = () => {
    fetch("/api/promotions?view=admin")
      .then((r) => r.json())
      .then((d) => {
        setPackages(d.packages ?? []);
        setSponsorships(d.sponsorships ?? []);
        setOffers(d.offers ?? []);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    const res = await fetch("/api/promotions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sponsorshipId: id, status: "approved" }),
    });
    if (res.ok) {
      toast.success("Sponsorship activated");
      load();
    } else toast.error("Failed");
  };

  const updatePrice = async (id: string, price: number) => {
    const res = await fetch("/api/promotions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { id, price } }),
    });
    if (res.ok) {
      toast.success("Pricing updated");
      load();
    }
  };

  return (
    <AdminPageShell
      title="Sponsorships & Offers"
      subtitle="Approve restaurant sponsorships and manage flash deals"
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
          <h2 className="mb-4 font-semibold text-ink">Sponsorship Packages</h2>
          <div className="space-y-3">
            {packages.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-xl bg-gray-50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-soft">{p.duration_days} days</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    defaultValue={Number(p.price)}
                    aria-label={`${p.name} price`}
                    className="h-11 w-full max-w-[8rem] rounded-xl border border-gray-200 px-3 text-sm sm:w-28"
                    onBlur={(e) => updatePrice(p.id, Number(e.target.value))}
                  />
                  <Badge tone={p.is_active ? "green" : "gray"}>
                    {p.is_active ? "Active" : "Off"}
                  </Badge>
                </div>
              </div>
            ))}
            {packages.length === 0 && (
              <p className="text-sm text-ink-muted">
                No packages in DB yet — seed data used on homepage.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
          <h2 className="mb-4 font-semibold text-ink">Sponsorship Requests</h2>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {sponsorships.map((s) => (
              <li key={s.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{s.restaurant_name}</p>
                  <Badge>{s.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatINR(Number(s.amount_paid))}
                </p>
                <p className="text-xs text-ink-soft">
                  {s.starts_at
                    ? new Date(s.starts_at).toLocaleDateString("en-IN")
                    : "—"}{" "}
                  →{" "}
                  {s.ends_at ? new Date(s.ends_at).toLocaleDateString("en-IN") : "—"}
                </p>
                {s.status === "pending" && (
                  <Button
                    size="md"
                    className="mt-3 min-h-11 w-full"
                    onClick={() => approve(s.id)}
                  >
                    Approve
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-ink-muted">
                  <th className="pb-2 font-medium">Restaurant</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Schedule</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sponsorships.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="py-3">{s.restaurant_name}</td>
                    <td className="py-3">{formatINR(Number(s.amount_paid))}</td>
                    <td className="py-3 text-xs text-ink-soft">
                      {s.starts_at
                        ? new Date(s.starts_at).toLocaleDateString("en-IN")
                        : "—"}{" "}
                      →{" "}
                      {s.ends_at
                        ? new Date(s.ends_at).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="py-3">
                      <Badge>{s.status}</Badge>
                    </td>
                    <td className="py-3">
                      {s.status === "pending" && (
                        <Button size="sm" onClick={() => approve(s.id)}>
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5">
          <h2 className="mb-4 font-semibold text-ink">Flash Offers</h2>
          <div className="space-y-2">
            {offers.map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-2 rounded-xl bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">
                    {o.restaurant_name} · {o.badge_text}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Ends {new Date(o.ends_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <Badge tone={o.is_active ? "orange" : "gray"}>
                  {o.is_active ? "Live" : "Off"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
