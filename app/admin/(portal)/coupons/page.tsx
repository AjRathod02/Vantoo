"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/lib/stores/toast";

type Coupon = {
  id: string;
  code: string;
  description: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  service: string | null;
};

const emptyForm = {
  code: "",
  description: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: 10,
  min_order_amount: 0,
  max_discount: "" as string | number,
  max_uses: "" as string | number,
  expires_at: "",
  is_active: true,
  service: "",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/coupons")
      .then((r) => r.json())
      .then((d) => setCoupons(d.coupons ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      min_order_amount: Number(c.min_order_amount),
      max_discount: c.max_discount ?? "",
      max_uses: c.max_uses ?? "",
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "",
      is_active: c.is_active,
      service: c.service ?? "",
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      code: form.code,
      description: form.description,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount),
      max_discount: form.max_discount === "" ? null : Number(form.max_discount),
      max_uses: form.max_uses === "" ? null : Number(form.max_uses),
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
      service: form.service || null,
    };
    try {
      const res = await fetch("/api/admin/coupons", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      toast.success(editingId ? "Coupon updated" : "Coupon created");
      resetForm();
      load();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const res = await fetch(`/api/admin/coupons?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Coupon deleted");
      if (editingId === id) resetForm();
      load();
    } else toast.error("Delete failed");
  };

  return (
    <AdminPageShell title="Coupons" subtitle="Create and manage promo codes">
      <div className="space-y-6">
        <form
          onSubmit={save}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
        >
          <h2 className="font-semibold text-ink">
            {editingId ? "Edit coupon" : "New coupon"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Discount type</span>
              <select
                value={form.discount_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount_type: e.target.value as "percent" | "fixed",
                  })
                }
                className="h-10 w-full rounded-xl border border-gray-200 px-3"
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>
            <Input
              label="Discount value"
              type="number"
              min={0}
              step="0.01"
              value={form.discount_value}
              onChange={(e) =>
                setForm({ ...form, discount_value: Number(e.target.value) })
              }
              required
            />
            <Input
              label="Min order amount"
              type="number"
              min={0}
              value={form.min_order_amount}
              onChange={(e) =>
                setForm({ ...form, min_order_amount: Number(e.target.value) })
              }
            />
            <Input
              label="Max discount"
              type="number"
              min={0}
              value={form.max_discount}
              onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
            />
            <Input
              label="Max uses"
              type="number"
              min={0}
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            />
            <Input
              label="Expires at"
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            />
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Service (optional)</span>
              <select
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
                className="h-10 w-full rounded-xl border border-gray-200 px-3"
              >
                <option value="">All services</option>
                <option value="food">Food</option>
                <option value="grocery">Grocery</option>
                <option value="medicine">Medicine</option>
                <option value="ecommerce">Ecommerce</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        {loading ? (
          <AdminTableSkeleton rows={4} cols={5} />
        ) : coupons.length === 0 ? (
          <p className="text-sm text-ink-muted">No coupons yet.</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {coupons.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{c.code}</p>
                      <p className="text-sm text-ink-muted">{c.description}</p>
                    </div>
                    <Badge tone={c.is_active ? "green" : "gray"}>
                      {c.is_active ? "Active" : "Off"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-ink">
                    {c.discount_type === "percent"
                      ? `${c.discount_value}%`
                      : `₹${c.discount_value}`}
                    {c.min_order_amount > 0 && (
                      <span className="text-ink-soft"> · min ₹{c.min_order_amount}</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Uses {c.used_count}
                    {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                    {c.expires_at
                      ? ` · Exp ${new Date(c.expires_at).toLocaleDateString("en-IN")}`
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      size="md"
                      variant="outline"
                      className="min-h-11 w-full"
                      onClick={() => startEdit(c)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="md"
                      variant="outline"
                      className="min-h-11 w-full"
                      onClick={() => remove(c.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-card md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-ink-muted">
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Discount</th>
                    <th className="pb-2 font-medium">Uses</th>
                    <th className="pb-2 font-medium">Expires</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="py-3">
                        <p className="font-medium text-ink">{c.code}</p>
                        <p className="text-xs text-ink-soft">{c.description}</p>
                      </td>
                      <td className="py-3">
                        {c.discount_type === "percent"
                          ? `${c.discount_value}%`
                          : `₹${c.discount_value}`}
                        {c.min_order_amount > 0 && (
                          <span className="block text-xs text-ink-soft">
                            min ₹{c.min_order_amount}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {c.used_count}
                        {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                      </td>
                      <td className="py-3 text-xs text-ink-soft">
                        {c.expires_at
                          ? new Date(c.expires_at).toLocaleString("en-IN")
                          : "—"}
                      </td>
                      <td className="py-3">
                        <Badge tone={c.is_active ? "green" : "gray"}>
                          {c.is_active ? "Active" : "Off"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => remove(c.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminPageShell>
  );
}
