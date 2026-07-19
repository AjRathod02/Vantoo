import { NextResponse } from "next/server";
import crypto from "crypto";
import { isRazorpayConfigured } from "@/lib/razorpay";
import {
  getPaymentAttemptByGatewayOrder,
  markPaymentAttemptFailed,
  recordPaymentWebhook,
  updatePaymentWebhookStatus,
} from "@/lib/server/payment-events";
import { finalizeOrderPayment } from "@/lib/server/orders";
import {
  completeGatewayRefund,
  markGatewayRefundFailed,
} from "@/lib/server/refunds";

export const dynamic = "force-dynamic";

function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Razorpay webhook for payment.captured / payment.failed / refund.processed.
 * Configure RAZORPAY_WEBHOOK_SECRET and point Razorpay dashboard to this URL.
 */
export async function POST(request: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId) {
    return NextResponse.json(
      { error: "x-razorpay-event-id is required" },
      { status: 400 }
    );
  }

  // Require webhook secret in production; allow unsigned in development only
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (secret) {
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "RAZORPAY_WEBHOOK_SECRET is required in production" },
      { status: 503 }
    );
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: Record<string, unknown> };
      refund?: { entity?: Record<string, unknown> };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = event.event ?? "";
  const payment = event.payload?.payment?.entity;
  const refund = event.payload?.refund?.entity;
  const gatewayOrderId =
    payment?.order_id == null ? null : String(payment.order_id);
  const gatewayPaymentId =
    payment?.id == null
      ? refund?.payment_id == null
        ? null
        : String(refund.payment_id)
      : String(payment.id);
  const gatewayRefundId = refund?.id == null ? null : String(refund.id);

  try {
    const stored = await recordPaymentWebhook({
      eventId,
      eventType: eventName,
      gatewayOrderId,
      gatewayPaymentId,
      gatewayRefundId,
      payload: event,
    });
    if (stored.processing_status === "processed") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (eventName === "payment.captured" && gatewayOrderId && gatewayPaymentId) {
      const attempt = await getPaymentAttemptByGatewayOrder(gatewayOrderId);
      const amountPaise = Number(payment?.amount);
      if (!attempt || !Number.isFinite(amountPaise)) {
        await updatePaymentWebhookStatus(eventId, "unmatched");
        return NextResponse.json({ received: true, unmatched: true });
      }
      await finalizeOrderPayment({
        userId: attempt.user_id,
        orderId: attempt.order_id,
        paymentAttemptId: attempt.id,
        gatewayOrderId,
        gatewayPaymentId,
        amountPaise,
      });
    }

    if (eventName === "payment.failed" && gatewayOrderId) {
      try {
        await markPaymentAttemptFailed({
          gatewayOrderId,
          gatewayPaymentId: gatewayPaymentId ?? undefined,
          failureCode:
            payment?.error_code == null ? undefined : String(payment.error_code),
          failureReason:
            payment?.error_description == null
              ? undefined
              : String(payment.error_description),
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("PAYMENT_ATTEMPT_NOT_FOUND")
        ) {
          await updatePaymentWebhookStatus(eventId, "unmatched");
          return NextResponse.json({ received: true, unmatched: true });
        }
        throw error;
      }
    }

    if (eventName === "refund.processed" && gatewayRefundId) {
      const amountPaise = Number(refund?.amount);
      if (!Number.isFinite(amountPaise)) {
        await updatePaymentWebhookStatus(eventId, "failed", "Invalid refund amount");
        return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
      }
      try {
        await completeGatewayRefund(gatewayRefundId, amountPaise);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("REFUND_ATTEMPT_NOT_FOUND")
        ) {
          await updatePaymentWebhookStatus(eventId, "unmatched");
          return NextResponse.json({ received: true, unmatched: true });
        }
        throw error;
      }
    }

    if (eventName === "refund.failed" && gatewayRefundId) {
      try {
        await markGatewayRefundFailed(
          gatewayRefundId,
          refund?.error_description == null
            ? "Gateway refund failed"
            : String(refund.error_description)
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("REFUND_ATTEMPT_NOT_FOUND")
        ) {
          await updatePaymentWebhookStatus(eventId, "unmatched");
          return NextResponse.json({ received: true, unmatched: true });
        }
        throw error;
      }
    }

    await updatePaymentWebhookStatus(eventId, "processed");
    return NextResponse.json({ received: true, event: eventName });
  } catch (e) {
    console.error("Razorpay webhook handler:", e);
    await updatePaymentWebhookStatus(
      eventId,
      "failed",
      e instanceof Error ? e.message : "Webhook processing failed"
    ).catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
