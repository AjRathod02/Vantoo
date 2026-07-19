import { API_BASE } from "./config";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateTokens,
  type SessionUser,
} from "./session";

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${API_BASE}/api/auth/mobile/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const data = await res.json();
  await updateTokens(data.session);
  return data.session.accessToken as string;
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(json.error || `Request failed (${res.status})`), {
      status: res.status,
      body: json,
    });
  }
  return json as T;
}

export async function mobileLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, app: "rider" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data as {
    user: SessionUser;
    session: { accessToken: string; refreshToken: string };
  };
}

export const RiderAPI = {
  me: () => apiFetch<{ user: SessionUser | null }>("/api/auth/me"),
  riderMe: () =>
    apiFetch<{
      rider: unknown;
      stats: unknown;
      availability: unknown;
      platformEnabled: boolean;
      warning?: string;
    }>("/api/rider/me"),
  deliveries: () => apiFetch<{ deliveries: unknown[] }>("/api/rider/deliveries"),
  earnings: () => apiFetch<{ earnings: unknown }>("/api/rider/earnings"),
  setAvailability: (online: boolean) =>
    apiFetch("/api/rider/availability", {
      method: "POST",
      body: JSON.stringify({ online }),
    }),
  apply: (body: unknown) =>
    apiFetch("/api/rider/apply", { method: "POST", body: JSON.stringify(body) }),
  postLocation: (body: {
    orderId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
  }) =>
    apiFetch("/api/rider/location", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
