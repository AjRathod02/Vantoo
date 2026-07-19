import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/utils/supabase/env";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  refreshToken: z.string().min(20),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const ip = clientIpFromRequest(request);
  const limited = await rateLimit({
    key: `mobile-refresh:${ip}`,
    limit: 60,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many refresh attempts.", retryAfterSec: limited.retryAfterSec },
      {
        status: limited.reason === "unavailable" ? 503 : 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "refreshToken is required." }, { status: 400 });
  }

  const { getSupabaseAnonKey, getSupabaseUrl } = await import("@/utils/supabase/env");
  const tokenRes = await fetch(
    `${getSupabaseUrl().replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: getSupabaseAnonKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: parsed.data.refreshToken }),
    }
  );
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    error?: string;
    error_description?: string;
    msg?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.json(
      {
        error:
          tokenJson.error_description ||
          tokenJson.msg ||
          tokenJson.error ||
          "Session expired. Please sign in again.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    session: {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? parsed.data.refreshToken,
      expiresAt: tokenJson.expires_at ?? null,
      expiresIn: tokenJson.expires_in ?? null,
      tokenType: tokenJson.token_type ?? "bearer",
    },
  });
}
