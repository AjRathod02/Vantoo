import { NextResponse } from "next/server";
import { z } from "zod";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { getSessionUser } from "@/lib/server/auth";
import {
  verifyCapturedRazorpayPayment,
  verifyRazorpaySignatureSafe,
} from "@/lib/payments/verify-payment";
import {
  finalizeOrderPayment,
  getPaymentAttemptForUser,
} from "@/lib/server/orders";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  vantoo_order_id: z.string(),
  payment_attempt_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimit({
    key: `razorpay-verify:${user.id}:${clientIpFromRequest(request)}`,
    limit: 30,
    windowMs: 5 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Payment verification is temporarily limited." },
      { status: limited.reason === "unavailable" ? 503 : 429 }
    );
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay is not configured" }, { status: 503 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    vantoo_order_id,
    payment_attempt_id,
  } = parsed.data;

  if (
    !verifyRazorpaySignatureSafe(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    )
  ) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  try {
    const attempt = await getPaymentAttemptForUser({
      userId: user.id,
      orderId: vantoo_order_id,
      paymentAttemptId: payment_attempt_id,
    });
    if (!attempt || attempt.gateway_order_id !== razorpay_order_id) {
      return NextResponse.json(
        { error: "Payment attempt not found" },
        { status: 404 }
      );
    }

    const verified = await verifyCapturedRazorpayPayment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      expectedAmountInr: attempt.amount_paise / 100,
      userId: user.id,
      vantooOrderId: vantoo_order_id,
    });
    const order = await finalizeOrderPayment({
      userId: user.id,
      orderId: vantoo_order_id,
      paymentAttemptId: payment_attempt_id,
      gatewayOrderId: razorpay_order_id,
      gatewayPaymentId: razorpay_payment_id,
      amountPaise: Math.round(verified.amountInr * 100),
    });

    return NextResponse.json({
      verified: true,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      order,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 400 }
    );
  }
}
