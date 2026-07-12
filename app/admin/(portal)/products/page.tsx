"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Apple,
  Pill,
  ShoppingBag,
  UtensilsCrossed,
  ArrowLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Product, ServiceType } from "@/lib/types";
import {
  PRODUCT_CATEGORY_FIELDS,
  PRODUCT_CATEGORY_LABELS,
  type ProductAttributeField,
} from "@/lib/admin/product-attributes";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import {
  AdminMediaUploader,
  type MediaItem,
} from "@/components/admin/AdminMediaUploader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { toast } from "@/lib/stores/toast";

const WIZARD_SERVICES = ["food", "grocery", "medicine", "ecommerce"] as const;
type WizardService = (typeof WIZARD_SERVICES)[number];

const CATEGORY_ICONS: Record<WizardService, React.ComponentType<{ className?: string }>> = {
  food: UtensilsCrossed,
  grocery: Apple,
  medicine: Pill,
  ecommerce: ShoppingBag,
};

const UNITS = ["piece", "kg", "g", "L", "ml", "pack", "dozen", "box"];

function emptyProduct(service: ServiceType = "food"): Product {
  return {
    id: "",
    name: "",
    description: "",
    service,
    category: "",
    brand: "",
    price: 0,
    originalPrice: undefined,
    rating: 4,
    reviews: 0,
    image: "",
    attributes: {},
    images: [],
    videos: [],
    thumbnailIndex: 0,
    vendorId: "",
    unit: "",
    inStock: true,
  };
}

function urlsToMediaItems(urls: string[], type: "image" | "video"): MediaItem[] {
  return urls.map((url, i) => ({
    id: `${type}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    type,
  }));
}

function getThumbnailIndex(images: MediaItem[], thumbnailId?: string): number {
  if (!thumbnailId || images.length === 0) return 0;
  const idx = images.findIndex((i) => i.id === thumbnailId);
  return idx >= 0 ? idx : 0;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-medium text-ink">{children}</span>;
}

function AttributeField({
  field,
  value,
  onChange,
}: {
  field: ProductAttributeField;
  value: string | number | boolean | null | undefined;
  onChange: (val: string | number | boolean | null) => void;
}) {
  const id = `attr-${field.key}`;

  if (field.type === "checkbox") {
    return (
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <span className="font-medium text-ink">{field.label}</span>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <FieldLabel>{field.label}</FieldLabel>
        <textarea
          id={id}
          className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          rows={3}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <FieldLabel>{field.label}</FieldLabel>
        <select
          id={id}
          className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <Input
      label={field.label}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      placeholder={field.placeholder}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) =>
        onChange(field.type === "number" ? Number(e.target.value) : e.target.value)
      }
    />
  );
}

type FormMode = "list" | "pick-category" | "form";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [mode, setMode] = useState<FormMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Product>(emptyProduct());
  const [imageItems, setImageItems] = useState<MediaItem[]>([]);
  const [videoItems, setVideoItems] = useState<MediaItem[]>([]);
  const [thumbnailId, setThumbnailId] = useState<string | undefined>();

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (serviceFilter) list = list.filter((p) => p.service === serviceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, serviceFilter, search]);

  const resetForm = () => {
    setForm(emptyProduct());
    setImageItems([]);
    setVideoItems([]);
    setThumbnailId(undefined);
    setEditingId(null);
    setMode("list");
  };

  const startAdd = () => {
    setForm(emptyProduct());
    setImageItems([]);
    setVideoItems([]);
    setThumbnailId(undefined);
    setEditingId(null);
    setMode("pick-category");
  };

  const selectCategory = (service: ServiceType) => {
    setForm(emptyProduct(service));
    setMode("form");
  };

  const loadIntoForm = (product: Product) => {
    const images = urlsToMediaItems(product.images ?? (product.image ? [product.image] : []), "image");
    const videos = urlsToMediaItems(product.videos ?? [], "video");
    const thumbIdx = product.thumbnailIndex ?? 0;
    setForm({
      ...emptyProduct(product.service),
      ...product,
      attributes: product.attributes ?? {},
      images: product.images ?? [],
      videos: product.videos ?? [],
      thumbnailIndex: thumbIdx,
    });
    setImageItems(images);
    setVideoItems(videos);
    setThumbnailId(images[thumbIdx]?.id ?? images[0]?.id);
    setEditingId(product.id);
    setMode("form");
  };

  const changeService = (service: ServiceType) => {
    if (service === form.service) return;
    if (!confirm("Changing category will reset category-specific attributes. Continue?")) return;
    setForm((prev) => ({
      ...prev,
      service,
      attributes: {},
    }));
  };

  const setAttribute = (key: string, val: string | number | boolean | null) => {
    setForm((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: val },
    }));
  };

  const buildPayload = (): Product => {
    const imageUrls = imageItems.map((i) => i.url);
    const videoUrls = videoItems.map((v) => v.url);
    const thumbIndex = getThumbnailIndex(imageItems, thumbnailId);
    const thumbnailUrl = imageUrls[thumbIndex] ?? imageUrls[0] ?? form.image;

    return {
      ...form,
      image: thumbnailUrl,
      images: imageUrls,
      videos: videoUrls,
      thumbnailIndex: thumbIndex,
      attributes: form.attributes ?? {},
      vendorId: form.vendorId || undefined,
      unit: form.unit || undefined,
      originalPrice: form.originalPrice || undefined,
    };
  };

  const save = async () => {
    const payload = buildPayload();
    if (!payload.id || !payload.name) {
      toast.error("Product ID and name are required");
      return;
    }
    if (!payload.image && imageItems.length === 0) {
      toast.error("Add at least one product image");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Failed to save product");
        return;
      }
      toast.success(editingId ? "Product updated" : "Product saved");
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Product deleted");
    if (editingId === id) resetForm();
    load();
  };

  const discount =
    form.originalPrice && form.originalPrice > form.price
      ? Math.round(((form.originalPrice - form.price) / form.originalPrice) * 100)
      : 0;

  const categoryFields = PRODUCT_CATEGORY_FIELDS[form.service as WizardService] ?? [];

  const columns: AdminColumn<Product>[] = useMemo(
    () => [
      {
        key: "image",
        label: "Image",
        render: (p) => (
          <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
            {p.image ? (
              p.image.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image src={p.image} alt="" fill className="object-cover" unoptimized />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-soft">—</div>
            )}
          </div>
        ),
      },
      {
        key: "name",
        label: "Name",
        sortable: true,
        sortValue: (p) => p.name,
        render: (p) => (
          <div>
            <p className="font-medium text-ink">{p.name}</p>
            <p className="text-xs text-ink-muted">{p.brand}</p>
          </div>
        ),
      },
      {
        key: "service",
        label: "Service",
        sortable: true,
        sortValue: (p) => p.service,
        render: (p) => (
          <span className="capitalize">{PRODUCT_CATEGORY_LABELS[p.service as WizardService] ?? p.service}</span>
        ),
      },
      {
        key: "category",
        label: "Category",
        sortable: true,
        sortValue: (p) => p.category,
        render: (p) => <span className="text-ink-muted">{p.category || "—"}</span>,
      },
      {
        key: "price",
        label: "Price",
        sortable: true,
        sortValue: (p) => p.price,
        render: (p) => (
          <div>
            <p>{formatINR(p.price)}</p>
            {p.originalPrice && p.originalPrice > p.price && (
              <p className="text-xs text-ink-soft line-through">{formatINR(p.originalPrice)}</p>
            )}
          </div>
        ),
      },
      {
        key: "stock",
        label: "Stock",
        sortable: true,
        sortValue: (p) => (p.inStock ? 1 : 0),
        render: (p) => (
          <AdminStatusBadge status={p.inStock ? "active" : "inactive"} />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        headerClassName: "text-right",
        className: "text-right",
        render: (p) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-primary hover:bg-brand-primary/5"
              onClick={() => loadIntoForm(p)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-secondary hover:bg-red-50"
              onClick={() => remove(p.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <AdminPageShell
      title="Products"
      subtitle="Category-first catalog wizard with media upload and attributes"
    >
      <div className="space-y-4">
        {mode === "list" && (
          <>
            <AdminFilterBar
              search={search}
              onSearchChange={setSearch}
              placeholder="Search name, ID, brand, category…"
              rightSlot={
                <Button type="button" onClick={startAdd}>
                  Add Product
                </Button>
              }
              filters={[
                {
                  key: "service",
                  label: "Service",
                  value: serviceFilter,
                  onChange: setServiceFilter,
                  options: [
                    { value: "", label: "All" },
                    ...WIZARD_SERVICES.map((s) => ({
                      value: s,
                      label: PRODUCT_CATEGORY_LABELS[s],
                    })),
                  ],
                },
              ]}
            />

            {loading ? (
              <AdminTableSkeleton cols={7} />
            ) : (
              <AdminDataTable
                rows={filteredProducts}
                columns={columns}
                rowKey={(p) => p.id}
                pageSize={20}
                minWidth="900px"
                emptyMessage="No products found. Add your first product."
              />
            )}
          </>
        )}

        {mode === "pick-category" && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to list
              </button>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-ink">Choose product category</h2>
            <p className="mb-6 text-sm text-ink-muted">
              Select a service type to configure category-specific fields.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {WIZARD_SERVICES.map((service) => {
                const Icon = CATEGORY_ICONS[service];
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => selectCategory(service)}
                    className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 bg-gray-50 p-8 transition-colors hover:border-brand-primary hover:bg-brand-primary/5"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Icon className="h-7 w-7 text-brand-primary" />
                    </div>
                    <span className="text-base font-semibold text-ink">
                      {PRODUCT_CATEGORY_LABELS[service]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === "form" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to list
              </button>
              <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-sm font-medium text-brand-primary">
                {PRODUCT_CATEGORY_LABELS[form.service as WizardService]}
                {editingId && (
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => {
                      const next = prompt(
                        "Change category? Enter: food, grocery, medicine, or ecommerce"
                      ) as ServiceType | null;
                      if (next && (WIZARD_SERVICES as readonly string[]).includes(next)) {
                        changeService(next);
                      }
                    }}
                  >
                    Change
                  </button>
                )}
              </span>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
              <h2 className="mb-5 text-base font-semibold text-ink">
                {editingId ? "Edit Product" : "New Product"}
              </h2>

              <div className="mb-6">
                <FieldLabel>Media</FieldLabel>
                <AdminMediaUploader
                  images={imageItems}
                  videos={videoItems}
                  thumbnailId={thumbnailId}
                  onImagesChange={(items) => {
                    setImageItems(items);
                    const idx = getThumbnailIndex(items, thumbnailId);
                    const url = items[idx]?.url ?? "";
                    if (url) setForm((prev) => ({ ...prev, image: url }));
                  }}
                  onVideosChange={setVideoItems}
                  onThumbnailChange={(id) => {
                    setThumbnailId(id);
                    const idx = imageItems.findIndex((i) => i.id === id);
                    const url = imageItems[idx]?.url;
                    if (url) setForm((prev) => ({ ...prev, image: url }));
                  }}
                />
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Product ID"
                  placeholder="e.g. p-food-101"
                  value={form.id}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
                <Input
                  label="Product Name"
                  placeholder="Product name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  label="Subcategory"
                  placeholder="e.g. Snacks, Dairy"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <Input
                  label="Brand"
                  placeholder="Brand name"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
                <Input
                  label="Selling Price (₹)"
                  type="number"
                  min={0}
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
                <Input
                  label="Original Price / MRP (₹)"
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={form.originalPrice ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      originalPrice: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
                <Input
                  label="Vendor ID"
                  placeholder="Optional vendor reference"
                  value={form.vendorId ?? ""}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                />
                <div>
                  <FieldLabel>Unit</FieldLabel>
                  <select
                    className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm"
                    value={form.unit ?? ""}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  >
                    <option value="">Select unit</option>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Rating (1–5)"
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                />
                <Input
                  label="Review Count"
                  type="number"
                  min={0}
                  value={form.reviews}
                  onChange={(e) => setForm({ ...form, reviews: Number(e.target.value) })}
                />
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.inStock}
                    onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="font-medium text-ink">In stock</span>
                </label>
              </div>

              <div className="mb-6">
                <FieldLabel>Description</FieldLabel>
                <textarea
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  rows={3}
                  placeholder="Product description, ingredients, highlights..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {categoryFields.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-4 text-sm font-semibold text-ink">
                    {PRODUCT_CATEGORY_LABELS[form.service as WizardService]}{" "}
                    Attributes
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryFields.map((field) => (
                      <AttributeField
                        key={field.key}
                        field={field}
                        value={form.attributes?.[field.key]}
                        onChange={(val) => setAttribute(field.key, val)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {discount > 0 && (
                <p className="mb-4 text-sm text-brand-accent">
                  {discount}% discount off MRP ({formatINR(form.originalPrice!)} →{" "}
                  {formatINR(form.price)})
                </p>
              )}

              <div className="flex gap-3">
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update Product" : "Save Product"}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
