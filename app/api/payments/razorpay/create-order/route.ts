import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { getRazorpay, isRazorpayConfigured, getRazorpayKeyId } from "@/lib/razorpay";
import { getSessionUser } from "@/lib/server/auth";
import { bindGatewayOrder, prepareOrder } from "@/lib/server/orders";
import { clientIpFromRequest, rateLimit } from "@/lib/security/rate-limit";

const addressSchema = z.object({
  id: z.string(),
  label: z.string(),
  line1: z.string(),
  line2: z.string(),
  city: z.string(),
  pincode: z.string(),
  isDefault: z.boolean().optional(),
});

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        variantId: z.string().optional(),
      })
    )
    .min(1),
  paymentMethod: z.enum(["card", "netbanking", "upi"]),
  address: addressSchema,
  service: z.enum(["food", "grocery", "medicine", "ecommerce", "local_shop"]),
  idempotencyKey: z.string().min(16).max(200),
  /** @deprecated Client amount is ignored; kept for backward compatibility. */
  amount: z.number().min(1).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimit({
    key: `razorpay-create:${user.id}:${clientIpFromRequest(request)}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Payment creation is temporarily limited." },
      { status: limited.reason === "unavailable" ? 503 : 429 }
    );
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Razorpay is not configured" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid cart", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        items: parsed.data.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        })),
        paymentMethod: parsed.data.paymentMethod,
        address: parsed.data.address,
        service: parsed.data.service,
      })
    )
    .digest("hex");

  let prepared;
  try {
    prepared = await prepareOrder({
      userId: user.id,
      idempotencyKey: parsed.data.idempotencyKey,
      requestHash,
      items: parsed.data.items,
      paymentMethod: parsed.data.paymentMethod,
      address: parsed.data.address,
      service: parsed.data.service,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to prepare order" },
      { status: 400 }
    );
  }

  const attempt = prepared.paymentAttempt;
  if (!attempt) {
    return NextResponse.json(
      { error: "Payment attempt was not created" },
      { status: 500 }
    );
  }

  if (attempt.gateway_order_id) {
    return NextResponse.json({
      orderId: attempt.gateway_order_id,
      vantooOrderId: prepared.order.id,
      paymentAttemptId: attempt.id,
      amount: attempt.amount_paise,
      currency: attempt.currency,
      keyId: getRazorpayKeyId(),
      serverTotal: attempt.amount_paise / 100,
      replayed: true,
    });
  }

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: attempt.amount_paise,
      currency: "INR",
      receipt: `vantoo_${prepared.order.id}`,
      notes: {
        userId: user.id,
        vantooOrderId: prepared.order.id,
        paymentAttemptId: attempt.id,
      },
    });
    await bindGatewayOrder({
      userId: user.id,
      orderId: prepared.order.id,
      paymentAttemptId: attempt.id,
      gatewayOrderId: order.id,
    });

    return NextResponse.json({
      orderId: order.id,
      vantooOrderId: prepared.order.id,
      paymentAttemptId: attempt.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      serverTotal: attempt.amount_paise / 100,
      replayed: prepared.replayed,
    });
  } catch (e) {
    console.error("Razorpay create order:", e);
    const rzpError = e as {
      statusCode?: number;
      error?: { description?: string; code?: string };
    };
    const description = rzpError.error?.description;
    const isAuthFailure =
      rzpError.statusCode === 401 ||
      description?.toLowerCase().includes("authentication");

    return NextResponse.json(
      {
        error: isAuthFailure
          ? "Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
          : description || "Failed to create payment order",
      },
      { status: isAuthFailure ? 502 : 500 }
    );
  }
}
