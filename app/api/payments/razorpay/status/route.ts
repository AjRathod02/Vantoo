import { NextResponse } from "next/server";
import { getRazorpay, isRazorpayConfigured } from "@/lib/razorpay";
import { getSessionUser } from "@/lib/server/auth";
import { verifyCapturedRazorpayPayment } from "@/lib/payments/verify-payment";
import {
  finalizeOrderPayment,
  getPaymentAttemptForUser,
} from "@/lib/server/orders";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimit({
    key: `razorpay-status:${user.id}:${clientIpFromRequest(request)}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Payment status checks are temporarily limited." },
      { status: limited.reason === "unavailable" ? 503 : 429 }
    );
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const paymentId = searchParams.get("paymentId");
  const vantooOrderId = searchParams.get("vantooOrderId");
  const paymentAttemptId = searchParams.get("paymentAttemptId");

  if (!orderId || !vantooOrderId || !paymentAttemptId) {
    return NextResponse.json(
      { error: "orderId, vantooOrderId and paymentAttemptId are required" },
      { status: 400 }
    );
  }

  try {
    const attempt = await getPaymentAttemptForUser({
      userId: user.id,
      orderId: vantooOrderId,
      paymentAttemptId,
    });
    if (!attempt || attempt.gateway_order_id !== orderId) {
      return NextResponse.json({ error: "Payment attempt not found" }, { status: 404 });
    }

    const razorpay = getRazorpay();
    const payments = await razorpay.orders.fetchPayments(orderId);
    const items = payments.items ?? [];

    if (paymentId) {
      const match = items.find((p) => p.id === paymentId);
      if (match?.status === "captured" && match.id) {
        const verified = await verifyCapturedRazorpayPayment({
          razorpayOrderId: orderId,
          razorpayPaymentId: match.id,
          expectedAmountInr: attempt.amount_paise / 100,
          userId: user.id,
          vantooOrderId,
        });
        const order = await finalizeOrderPayment({
          userId: user.id,
          orderId: vantooOrderId,
          paymentAttemptId,
          gatewayOrderId: orderId,
          gatewayPaymentId: match.id,
          amountPaise: Math.round(verified.amountInr * 100),
        });
        return NextResponse.json({
          status: "captured",
          verified: true,
          razorpayOrderId: orderId,
          razorpayPaymentId: match.id,
          order,
        });
      }
    }

    const captured = items.find((p) => p.status === "captured");
    if (captured?.id) {
      const verified = await verifyCapturedRazorpayPayment({
        razorpayOrderId: orderId,
        razorpayPaymentId: captured.id,
        expectedAmountInr: attempt.amount_paise / 100,
        userId: user.id,
        vantooOrderId,
      });
      const order = await finalizeOrderPayment({
        userId: user.id,
        orderId: vantooOrderId,
        paymentAttemptId,
        gatewayOrderId: orderId,
        gatewayPaymentId: captured.id,
        amountPaise: Math.round(verified.amountInr * 100),
      });
      return NextResponse.json({
        status: "captured",
        verified: true,
        razorpayOrderId: orderId,
        razorpayPaymentId: captured.id,
        order,
      });
    }

    const failed = items.find((p) => p.status === "failed");
    if (failed) {
      return NextResponse.json({
        status: "failed",
        verified: false,
        razorpayOrderId: orderId,
        failureReason:
          (failed.error_description as string | undefined) ||
          (failed.error_reason as string | undefined) ||
          "Payment failed",
      });
    }

    return NextResponse.json({
      status: "pending",
      verified: false,
      razorpayOrderId: orderId,
    });
  } catch (e) {
    console.error("Razorpay status check:", e);
    return NextResponse.json({ error: "Failed to check payment status" }, { status: 500 });
  }
}
