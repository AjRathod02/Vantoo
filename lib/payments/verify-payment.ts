import crypto from "crypto";
import { getRazorpay, verifyRazorpaySignature } from "@/lib/razorpay";
import { hasAdminClient, createAdminClient } from "@/utils/supabase/admin";

export function verifyRazorpaySignatureSafe(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;

  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return verifyRazorpaySignature(orderId, paymentId, signature);
  }
}

export async function findOrderByRazorpayPaymentId(
  paymentId: string
): Promise<{ id: string; userId?: string } | null> {
  if (!paymentId) return null;

  if (!hasAdminClient()) {
    throw new Error("Durable payment database is not configured");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    return {
      id: data.id as string,
      userId: (data.user_id as string | null) ?? undefined,
    };
  }
  return null;
}

export async function assertPaymentUnused(paymentId: string, allowedOrderId?: string) {
  const existing = await findOrderByRazorpayPaymentId(paymentId);
  if (existing && existing.id !== allowedOrderId) {
    throw new Error("Payment already used for another order");
  }
}

/**
 * Fetch Razorpay payment and confirm it is captured for the given order + amount (INR).
 */
export async function verifyCapturedRazorpayPayment(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  expectedAmountInr: number;
  userId: string;
  vantooOrderId?: string;
}): Promise<{ razorpayOrderId: string; razorpayPaymentId: string; amountInr: number }> {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    expectedAmountInr,
    userId,
  } = opts;

  if (razorpaySignature) {
    const ok = verifyRazorpaySignatureSafe(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!ok) throw new Error("Invalid payment signature");
  }

  await assertPaymentUnused(razorpayPaymentId, opts.vantooOrderId);

  const razorpay = getRazorpay();
  const payment = await razorpay.payments.fetch(razorpayPaymentId);

  if (payment.order_id !== razorpayOrderId) {
    throw new Error("Payment does not match Razorpay order");
  }

  const status = String(payment.status || "");
  if (status !== "captured" && status !== "authorized") {
    throw new Error(`Payment not successful (status: ${status})`);
  }

  const paidPaise = Number(payment.amount);
  const expectedPaise = Math.round(expectedAmountInr * 100);
  if (!Number.isFinite(paidPaise) || paidPaise !== expectedPaise) {
    throw new Error("Paid amount does not match order total");
  }

  const notes = (payment.notes || {}) as Record<string, string>;
  if (notes.userId && notes.userId !== userId) {
    throw new Error("Payment belongs to a different user");
  }

  // Prefer capturing authorized payments immediately
  if (status === "authorized") {
    try {
      await razorpay.payments.capture(razorpayPaymentId, paidPaise, "INR");
    } catch (e) {
      console.error("Razorpay capture:", e);
      throw new Error("Payment capture failed");
    }
  }

  return {
    razorpayOrderId,
    razorpayPaymentId,
    amountInr: paidPaise / 100,
  };
}
