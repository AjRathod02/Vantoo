import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { listOrders, prepareOrder } from "@/lib/server/orders";
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

const orderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().optional(),
        name: z.string().optional(),
        image: z.string().optional(),
        price: z.number().optional(),
        quantity: z.number().min(1),
      })
    )
    .min(1),
  subtotal: z.number().optional(),
  deliveryFee: z.number().optional(),
  tax: z.number().optional(),
  discount: z.number().optional(),
  total: z.number().optional(),
  paymentMethod: z.enum(["card", "netbanking", "upi", "cod"]),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  address: addressSchema,
  service: z.enum(["food", "grocery", "medicine", "ecommerce", "local_shop"]),
  idempotencyKey: z.string().min(16).max(200),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const orders = await listOrders(user.id);
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  const limited = await rateLimit({
    key: `order-create:${user.id}:${clientIpFromRequest(request)}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Order creation is temporarily limited." },
      { status: limited.reason === "unavailable" ? 503 : 429 }
    );
  }

  const body = await request.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.paymentMethod !== "cod") {
    return NextResponse.json(
      { error: "Online orders must use the Razorpay payment-intent flow" },
      { status: 409 }
    );
  }

  try {
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
    const result = await prepareOrder({
      userId: user.id,
      items: parsed.data.items,
      service: parsed.data.service,
      address: parsed.data.address,
      paymentMethod: "cod",
      idempotencyKey: parsed.data.idempotencyKey,
      requestHash,
    });
    return NextResponse.json(
      { order: result.order, replayed: result.replayed },
      { status: result.replayed ? 200 : 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
