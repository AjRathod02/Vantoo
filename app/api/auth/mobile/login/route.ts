import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { isSupabaseConfigured } from "@/utils/supabase/env";
import type { User } from "@/lib/types";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  app: z.enum(["customer", "vendor", "rider"]).default("customer"),
});

function mapUser(
  authUser: { id: string; email?: string; user_metadata?: Record<string, string> },
  profile?: { name?: string | null; phone?: string | null; role?: string | null } | null
): User {
  return {
    id: authUser.id,
    name: profile?.name || authUser.user_metadata?.name || "Vantoo User",
    phone: profile?.phone || authUser.user_metadata?.phone || "",
    email: authUser.email,
    role: profile?.role === "admin" ? "admin" : "customer",
  };
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const ip = clientIpFromRequest(request);
  const limited = await rateLimit({
    key: `mobile-login:${ip}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: "Too many login attempts. Please try again later.",
        retryAfterSec: limited.retryAfterSec,
      },
      {
        status: limited.reason === "unavailable" ? 503 : 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password (min 6 characters)." },
      { status: 400 }
    );
  }

  const { email, password, app } = parsed.data;

  // Prefer Auth REST password grant — reliably returns refresh_token for mobile clients.
  const { getSupabaseAnonKey, getSupabaseUrl } = await import("@/utils/supabase/env");
  const tokenRes = await fetch(
    `${getSupabaseUrl().replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: getSupabaseAnonKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }
  );
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    user?: {
      id: string;
      email?: string;
      user_metadata?: Record<string, string>;
    };
    error?: string;
    error_description?: string;
    msg?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.user) {
    const raw =
      tokenJson.error_description ||
      tokenJson.msg ||
      tokenJson.error ||
      "Login failed.";
    const message =
      raw === "Invalid login credentials"
        ? "Invalid email or password."
        : raw.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email before signing in."
          : raw;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let profile: { name?: string | null; phone?: string | null; role?: string | null } | null =
    null;
  if (hasAdminClient()) {
    try {
      const { data: row } = await createAdminClient()
        .from("profiles")
        .select("name, phone, role")
        .eq("id", tokenJson.user.id)
        .maybeSingle();
      profile = row;
    } catch {
      // ignore
    }
  }

  const user = mapUser(tokenJson.user, profile);

  return NextResponse.json({
    user,
    app,
    session: {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? "",
      expiresAt: tokenJson.expires_at ?? null,
      expiresIn: tokenJson.expires_in ?? null,
      tokenType: tokenJson.token_type ?? "bearer",
      hasRefreshToken: Boolean(tokenJson.refresh_token),
    },
  });
}
