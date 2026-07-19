import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/rbac";
import { getOrder, listAllOrders } from "@/lib/server/orders";
import { logAdminAction } from "@/lib/admin/audit";
import { getRazorpay, isRazorpayConfigured } from "@/lib/razorpay";
import {
  bindGatewayRefund,
  prepareRefundAttempt,
} from "@/lib/server/refunds";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const ctx = await requireAdminAuth();
    if (!hasPermission(ctx.permissions, "refunds", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orders = await listAllOrders();
    const refunds = orders.filter(
      (o) => o.refundStatus && o.refundStatus !== "none"
    );

    return NextResponse.json({ refunds });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireAdminAuth();
    if (!hasPermission(ctx.permissions, "refunds", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const limited = await rateLimit({
      key: `admin-refund:${ctx.admin.id}:${clientIpFromRequest(request)}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Refund requests are temporarily limited." },
        { status: limited.reason === "unavailable" ? 503 : 429 }
      );
    }

    const body = await request.json();
    const { orderId, action, amount, reason, idempotencyKey: requestedKey } = body as {
      orderId?: string;
      action?: string;
      amount?: number;
      reason?: string;
      idempotencyKey?: string;
    };

    if (!orderId || !action) {
      return NextResponse.json(
        { error: "orderId and action are required" },
        { status: 400 }
      );
    }

    const existing = await getOrder(orderId);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const maxRefund = existing.total;
    const refundAmount =
      typeof amount === "number" && Number.isFinite(amount) ? amount : maxRefund;

    if (refundAmount <= 0 || refundAmount > maxRefund) {
      return NextResponse.json(
        { error: `Refund amount must be between 0 and ${maxRefund}` },
        { status: 400 }
      );
    }

    if (!["approve", "partial", "complete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (
      !existing.razorpayPaymentId ||
      !isRazorpayConfigured() ||
      !["paid", "partially_refunded"].includes(existing.paymentStatus ?? "")
    ) {
      return NextResponse.json(
        { error: "Order does not have a refundable captured payment" },
        { status: 409 }
      );
    }

    const amountPaise = Math.round(refundAmount * 100);
    const idempotencyKey =
      typeof requestedKey === "string" && requestedKey.length >= 16
        ? requestedKey
        : createHash("sha256")
            .update(`${orderId}:${amountPaise}:${reason ?? ""}`)
            .digest("hex");
    const attempt = await prepareRefundAttempt({
      orderId,
      requestedBy: ctx.admin.id,
      amountPaise,
      reason: reason || "Admin refund",
      idempotencyKey,
    });

    if (!attempt.gateway_refund_id) {
      try {
        const razorpay = getRazorpay();
        const gatewayRefund = await razorpay.payments.refund(
          existing.razorpayPaymentId,
          {
            amount: amountPaise,
            notes: {
              orderId,
              refundAttemptId: attempt.id,
              adminId: ctx.admin.id,
            },
          }
        );
        await bindGatewayRefund(attempt.id, gatewayRefund.id);
      } catch (e) {
        console.error("Razorpay refund failed:", e);
        return NextResponse.json(
          {
            error:
              e instanceof Error
                ? e.message
                : "Razorpay refund request failed",
          },
          { status: 502 }
        );
      }
    }

    const order = (await getOrder(orderId)) ?? existing;
    await logAdminAction({
      adminId: ctx.admin.id,
      adminEmail: ctx.admin.email,
      action,
      resource: "refunds",
      resourceId: orderId,
      details: { amount: refundAmount, reason },
    });

    return NextResponse.json({
      order,
      refundAttempt: {
        id: attempt.id,
        status: attempt.status,
        gatewayRefundId: attempt.gateway_refund_id,
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
