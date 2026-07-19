import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminClient } from "@/utils/supabase/admin";
import { issuePasswordResetLink } from "@/lib/auth/password-reset";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  if (!hasAdminClient()) {
    return NextResponse.json(
      { error: "Authentication service is not configured." },
      { status: 503 }
    );
  }

  const ip = clientIpFromRequest(request);
  const limited = await rateLimit({
    key: `forgot-password:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: "Too many reset requests. Please try again later.",
        retryAfterSec: limited.retryAfterSec,
      },
      {
        status: limited.reason === "unavailable" ? 503 : 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const emailLimited = await rateLimit({
    key: `forgot-password-email:${email}`,
    limit: 3,
    windowMs: 15 * 60 * 1000,
  });
  if (!emailLimited.ok) {
    return NextResponse.json(
      {
        error: "Too many reset requests for this email. Please try again later.",
        retryAfterSec: emailLimited.retryAfterSec,
      },
      {
        status: emailLimited.reason === "unavailable" ? 503 : 429,
        headers: { "Retry-After": String(emailLimited.retryAfterSec) },
      }
    );
  }

  const origin = new URL(request.url).origin;
  const issued = await issuePasswordResetLink({ email, origin });

  if (!issued.ok) {
    return NextResponse.json(
      {
        error: issued.error,
        resendAvailableAt: issued.resendAvailableAt,
      },
      { status: issued.status }
    );
  }

  return NextResponse.json({
    message:
      "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.",
    expiresAt: issued.expiresAt,
    ...(issued.debugResetUrl ? { debugResetUrl: issued.debugResetUrl } : {}),
  });
}
