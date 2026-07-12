"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/lib/stores/toast";

type CategoryRow = {
  id: string;
  name: string;
  service: string;
  icon: string;
  image: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm = {
  id: "",
  name: "",
  service: "food",
  icon: "Tag",
  image: "",
  sort_order: 0,
  is_active: true,
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(false);
    setForm(emptyForm);
  };

  const startEdit = (c: CategoryRow) => {
    setEditing(true);
    setForm({
      id: c.id,
      name: c.name,
      service: c.service,
      icon: c.icon,
      image: c.image,
      sort_order: Number(c.sort_order),
      is_active: c.is_active,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? {
                id: form.id,
                name: form.name,
                service: form.service,
                icon: form.icon,
                image: form.image,
                sort_order: Number(form.sort_order),
                is_active: form.is_active,
              }
            : form
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      toast.success(editing ? "Category updated" : "Category created");
      resetForm();
      load();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    const res = await fetch(`/api/admin/categories?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Category deleted");
      if (form.id === id) resetForm();
      load();
    } else toast.error("Delete failed");
  };

  return (
    <AdminPageShell title="Categories" subtitle="Manage product category catalog">
      <div className="space-y-6">
        <form
          onSubmit={save}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card"
        >
          <h2 className="font-semibold text-ink">
            {editing ? "Edit category" : "New category"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="ID"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              disabled={editing}
              required
              placeholder="c-pizza"
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <label className="text-sm">
              <span className="mb-1 block text-ink-muted">Service</span>
              <select
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
                className="h-10 w-full rounded-xl border border-gray-200 px-3"
              >
                <option value="food">Food</option>
                <option value="grocery">Grocery</option>
                <option value="medicine">Medicine</option>
                <option value="ecommerce">Ecommerce</option>
              </select>
            </label>
            <Input
              label="Icon"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            />
            <Input
              label="Image URL"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
            />
            <Input
              label="Sort order"
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm({ ...form, sort_order: Number(e.target.value) })
              }
            />
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
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        {loading ? (
          <AdminTableSkeleton rows={5} cols={5} />
        ) : categories.length === 0 ? (
          <p className="text-sm text-ink-muted">No categories yet.</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-sm capitalize text-ink-muted">{c.service}</p>
                    </div>
                    <Badge tone={c.is_active ? "green" : "gray"}>
                      {c.is_active ? "Active" : "Off"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">Sort {c.sort_order}</p>
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
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-ink-muted">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Service</th>
                    <th className="pb-2 font-medium">Sort</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="py-3">
                        <p className="font-medium text-ink">{c.name}</p>
                        <p className="font-mono text-xs text-ink-soft">{c.id}</p>
                      </td>
                      <td className="py-3 capitalize">{c.service}</td>
                      <td className="py-3">{c.sort_order}</td>
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
