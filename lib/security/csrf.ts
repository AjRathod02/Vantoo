import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * SameSite=Lax cookies already block classic CSRF for cross-site POSTs.
 * This Origin/Referer check adds defense-in-depth for mutating /api routes.
 */
export function isAllowedMutatingOrigin(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return true;

  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return true;

  // Public webhooks / streams that may not send Origin
  if (pathname.startsWith("/api/setup/")) return true;
  if (pathname.startsWith("/api/payments/razorpay/webhook")) return true;
  if (pathname.includes("/stream")) return true;
  // Mobile token exchange does not send browser Origin
  if (pathname.startsWith("/api/auth/mobile/")) return true;

  // Native apps authenticate with Bearer tokens (no Origin header)
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ") && authorization.length > 27) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!host) return true;

  const allowed = new Set<string>([
    `http://${host}`,
    `https://${host}`,
  ]);

  if (origin) {
    try {
      const o = new URL(origin);
      return allowed.has(`${o.protocol}//${o.host}`);
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const r = new URL(referer);
      return allowed.has(`${r.protocol}//${r.host}`);
    } catch {
      return false;
    }
  }

  // Same-origin fetch from curl/native clients without Origin — allow in development
  return process.env.NODE_ENV !== "production";
}
