import { API_BASE } from "./config";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateTokens,
  type SessionUser,
} from "./session";

export type ApiError = { error: string; status: number };

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/api/auth/mobile/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const data = (await res.json()) as {
    session: { accessToken: string; refreshToken: string };
  };
  await updateTokens(data.session);
  return data.session.accessToken;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    token = await refreshAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      return apiFetch<T>(path, { ...init, headers }, false);
    }
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text || res.statusText };
  }

  if (!res.ok) {
    const err = (json as { error?: string })?.error || `Request failed (${res.status})`;
    throw Object.assign(new Error(err), { status: res.status, body: json });
  }
  return json as T;
}

export async function mobileLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password, app: "customer" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data as {
    user: SessionUser;
    session: {
      accessToken: string;
      refreshToken: string;
      expiresAt?: number | null;
    };
  };
}

export const CustomerAPI = {
  me: () => apiFetch<{ user: SessionUser | null }>("/api/auth/me"),
  products: (q?: string) =>
    apiFetch<{ products: Product[] }>(
      `/api/products?limit=30${q ? `&q=${encodeURIComponent(q)}` : ""}`
    ),
  product: (id: string) => apiFetch<{ product: Product }>(`/api/products/${id}`),
  orders: () => apiFetch<{ orders: Order[] }>("/api/orders"),
  order: (id: string) => apiFetch<{ order: Order }>(`/api/orders/${id}`),
  createOrder: (body: unknown) =>
    apiFetch<{ order: Order }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelOrder: (id: string) =>
    apiFetch<{ order: Order }>(`/api/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  tracking: (id: string) =>
    apiFetch<{ tracking: unknown }>(`/api/orders/${id}/tracking`),
  offers: () => apiFetch<{ offers: unknown[] }>("/api/customer/offers"),
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  image?: string;
  service?: string;
  category?: string;
  inStock?: boolean;
  rating?: number;
};

export type Order = {
  id: string;
  status: string;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
};
