import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminClient } from "@/utils/supabase/admin";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { updateCustomerPassword } from "@/lib/auth/password";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(20),
  newPassword: z.string().min(6),
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
    key: `reset-password:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: "Too many attempts. Please try again later.",
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
      {
        error:
          "Enter a valid reset link, email, and a new password (min 6 characters).",
      },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const consumed = await consumePasswordResetToken({
    email,
    token: parsed.data.token,
  });
  if (!consumed.ok) {
    return NextResponse.json(
      { error: consumed.error },
      { status: consumed.status }
    );
  }

  const updated = await updateCustomerPassword(
    consumed.userId,
    parsed.data.newPassword
  );
  if (!updated.ok) {
    return NextResponse.json({ error: updated.error }, { status: 500 });
  }

  return NextResponse.json({
    message: "Password updated successfully. Please log in with your new password.",
  });
}
