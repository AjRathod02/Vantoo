import type { Order, Product, Restaurant, Offer } from "@/lib/types";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export interface ProductQuery {
  service?: string;
  category?: string;
  q?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export function buildProductUrl(query: ProductQuery): string {
  const params = new URLSearchParams();
  if (query.service) params.set("service", query.service);
  if (query.category) params.set("category", query.category);
  if (query.q) params.set("q", query.q);
  if (query.brands?.length) params.set("brands", query.brands.join(","));
  if (query.minPrice) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice && query.maxPrice !== Infinity)
    params.set("maxPrice", String(query.maxPrice));
  if (query.minRating) params.set("minRating", String(query.minRating));
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  return `/api/products?${params.toString()}`;
}

export const api = {
  products: (query: ProductQuery = {}) =>
    getJSON<{
      products: Product[];
      count: number;
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    }>(buildProductUrl(query)),
  product: (id: string) =>
    getJSON<{ product: Product; related: Product[] }>(`/api/products/${id}`),
  restaurants: () => getJSON<{ restaurants: Restaurant[] }>("/api/restaurants"),
  offers: () => getJSON<{ offers: Offer[] }>("/api/offers"),
  orders: () => getJSON<{ orders: Order[] }>("/api/orders"),
  order: (id: string) => getJSON<{ order: Order }>(`/api/orders/${id}`),
};
