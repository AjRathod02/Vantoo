import { unstable_cache, revalidateTag } from "next/cache";
import type { Product } from "@/lib/types";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { products as seedProducts } from "@/lib/data/products";

type DbProductRow = {
  id: string;
  name: string;
  description: string;
  service: Product["service"];
  category: string;
  brand: string;
  price: number;
  original_price: number | null;
  rating: number;
  reviews: number;
  image: string;
  images?: unknown;
  videos?: unknown;
  attributes?: unknown;
  thumbnail_index?: number;
  vendor_id: string | null;
  unit: string | null;
  in_stock: boolean;
};

export type ProductFilters = {
  service?: string;
  category?: string;
  q?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: string;
  vendorId?: string;
  page?: number;
  limit?: number;
};

export type ProductPage = {
  products: Product[];
  count: number;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

function database() {
  if (!hasAdminClient()) {
    throw new Error("Supabase catalog database is not configured");
  }
  return createAdminClient();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && "url" in entry) {
        return String((entry as { url: string }).url);
      }
      return "";
    })
    .filter(Boolean);
}

function asAttributes(value: unknown): Product["attributes"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Product["attributes"];
}

function rowToProduct(row: DbProductRow): Product {
  const images = asStringArray(row.images);
  const videos = asStringArray(row.videos);
  const thumbnailIndex = row.thumbnail_index ?? 0;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    service: row.service,
    category: row.category,
    brand: row.brand,
    price: Number(row.price),
    originalPrice:
      row.original_price == null ? undefined : Number(row.original_price),
    rating: Number(row.rating),
    reviews: row.reviews,
    image: images[thumbnailIndex] || images[0] || row.image,
    images,
    videos,
    thumbnailIndex,
    attributes: asAttributes(row.attributes),
    vendorId: row.vendor_id ?? undefined,
    unit: row.unit ?? undefined,
    inStock: row.in_stock,
  };
}

function productToRow(product: Product) {
  const images = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : [];
  const thumbnailIndex = product.thumbnailIndex ?? 0;
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    service: product.service,
    category: product.category,
    brand: product.brand,
    price: product.price,
    original_price: product.originalPrice ?? null,
    rating: product.rating,
    reviews: product.reviews,
    image: images[thumbnailIndex] || product.image || "",
    images,
    videos: product.videos ?? [],
    attributes: product.attributes ?? {},
    thumbnail_index: thumbnailIndex,
    vendor_id: product.vendorId ?? null,
    unit: product.unit ?? null,
    in_stock: product.inStock,
    updated_at: new Date().toISOString(),
  };
}

function normalizeFilters(filters: ProductFilters): Required<
  Pick<ProductFilters, "page" | "limit">
> &
  Omit<ProductFilters, "page" | "limit"> {
  return {
    ...filters,
    q: filters.q?.trim().slice(0, 100) || undefined,
    brands: filters.brands?.filter(Boolean).slice(0, 20),
    minPrice: Number.isFinite(filters.minPrice) ? filters.minPrice : undefined,
    maxPrice: Number.isFinite(filters.maxPrice) ? filters.maxPrice : undefined,
    minRating: Number.isFinite(filters.minRating) ? filters.minRating : undefined,
    page: Math.max(1, Math.min(Math.floor(filters.page ?? 1), 10_000)),
    limit: Math.max(1, Math.min(Math.floor(filters.limit ?? 24), 100)),
  };
}

async function queryProductPage(serialized: string): Promise<ProductPage> {
  const filters = JSON.parse(serialized) as ReturnType<typeof normalizeFilters>;
  const supabase = database();
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  let query = supabase.from("products").select("*", { count: "exact" });

  if (filters.service) query = query.eq("service", filters.service);
  if (filters.vendorId) query = query.eq("vendor_id", filters.vendorId);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.brands?.length) query = query.in("brand", filters.brands);
  if (filters.minPrice != null) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);
  if (filters.minRating != null) query = query.gte("rating", filters.minRating);
  if (filters.q) {
    const safe = filters.q.replace(/[%_,.()]/g, " ").trim();
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,brand.ilike.%${safe}%,description.ilike.%${safe}%`
      );
    }
  }

  if (filters.sort === "price-asc") {
    query = query.order("price", { ascending: true });
  } else if (filters.sort === "price-desc") {
    query = query.order("price", { ascending: false });
  } else if (filters.sort === "rating") {
    query = query.order("rating", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }
  query = query.order("id", { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const products = ((data ?? []) as DbProductRow[]).map(rowToProduct);
  const total = count ?? products.length;
  return {
    products,
    count: products.length,
    total,
    page: filters.page,
    limit: filters.limit,
    hasMore: from + products.length < total,
  };
}

const cachedProductPage = unstable_cache(
  queryProductPage,
  ["public-product-catalog-v1"],
  { revalidate: 30, tags: ["catalog"] }
);

export async function listProductsPage(
  filters: ProductFilters = {},
  options: { cache?: boolean } = {}
) {
  const normalized = normalizeFilters(filters);
  const serialized = JSON.stringify(normalized);
  return options.cache === false
    ? queryProductPage(serialized)
    : cachedProductPage(serialized);
}

export async function listProducts(
  filters: ProductFilters = {}
): Promise<Product[]> {
  const page = await listProductsPage(
    { ...filters, page: filters.page ?? 1, limit: filters.limit ?? 100 },
    { cache: true }
  );
  return page.products;
}

const cachedProduct = unstable_cache(
  async (id: string) => {
    const { data, error } = await database()
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToProduct(data as DbProductRow) : undefined;
  },
  ["public-product-detail-v1"],
  { revalidate: 30, tags: ["catalog"] }
);

export async function getProduct(id: string): Promise<Product | undefined> {
  return cachedProduct(id);
}

export async function upsertProduct(product: Product) {
  const { error } = await database().from("products").upsert(productToRow(product));
  if (error) throw new Error(error.message);
  revalidateTag("catalog");
  return product;
}

export async function deleteProduct(id: string) {
  const { error } = await database().from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("catalog");
}

export async function seedProductsIfEmpty() {
  const supabase = database();
  const { count, error: countError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });
  if (countError) throw new Error(countError.message);
  if (count && count > 0) return { seeded: false, count };

  const rows = seedProducts.map(productToRow);
  const { error } = await supabase.from("products").insert(rows);
  if (error) throw new Error(error.message);
  revalidateTag("catalog");
  return { seeded: true, count: rows.length };
}
