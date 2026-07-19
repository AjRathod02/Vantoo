import type { Order, OrderStatus, RiderLocationUpdate } from "@/lib/types";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { normalizeStatus } from "@/lib/orderStatus";
import { publishRiderLocation } from "@/lib/tracking/broadcaster";
import { getRedisCommand, redisKey } from "@/lib/redis/client";

type DbOrderRow = {
  id: string;
  user_id: string | null;
  items: Order["items"];
  subtotal: number;
  delivery_fee: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  payment_method: Order["paymentMethod"];
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  refund_status: Order["refundStatus"] | null;
  refund_amount: number | null;
  address: Order["address"];
  service: Order["service"];
  rider_name: string | null;
  rider_phone: string | null;
  rider_lat: number | null;
  rider_lng: number | null;
  placed_at: string;
  cancelled_at: string | null;
  tracking_updated_at?: string | null;
};

export type PaymentAttempt = {
  id: string;
  order_id: string;
  user_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
};

type PrepareOrderResult = {
  order: DbOrderRow;
  paymentAttempt: PaymentAttempt | null;
  replayed: boolean;
};

function database() {
  if (!hasAdminClient()) {
    throw new Error("Durable order database is not configured");
  }
  return createAdminClient();
}

function normalizePaymentStatus(value: string): Order["paymentStatus"] {
  if (value === "paid") return "paid";
  if (value === "failed") return "failed";
  if (value === "refunded" || value === "refund_completed") return "refunded";
  if (value === "processing" || value === "verification_pending") {
    return "processing";
  }
  if (value === "partially_refunded") return "partially_refunded";
  return "pending";
}

function rowToOrder(row: DbOrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    items: row.items,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    tax: Number(row.tax),
    discount: Number(row.discount),
    total: Number(row.total),
    status: normalizeStatus(row.status),
    paymentMethod: row.payment_method,
    paymentStatus: normalizePaymentStatus(row.payment_status),
    razorpayOrderId: row.razorpay_order_id ?? undefined,
    razorpayPaymentId: row.razorpay_payment_id ?? undefined,
    refundStatus: row.refund_status ?? "none",
    refundAmount:
      row.refund_amount == null ? undefined : Number(row.refund_amount),
    address: row.address,
    service: row.service,
    placedAt: row.placed_at,
    cancelledAt: row.cancelled_at ?? undefined,
    tracking: {
      riderName: row.rider_name ?? undefined,
      riderPhone: row.rider_phone ?? undefined,
      riderLat: row.rider_lat == null ? undefined : Number(row.rider_lat),
      riderLng: row.rider_lng == null ? undefined : Number(row.rider_lng),
      updatedAt: row.tracking_updated_at ?? undefined,
    },
  };
}

function rpcError(error: { message?: string } | null, fallback: string) {
  if (!error) return;
  throw new Error(error.message || fallback);
}

export async function prepareOrder(input: {
  userId: string;
  idempotencyKey: string;
  requestHash: string;
  items: Array<{ productId: string; quantity: number; variantId?: string }>;
  paymentMethod: Order["paymentMethod"];
  address: Order["address"];
  service: Order["service"];
}): Promise<{
  order: Order;
  paymentAttempt: PaymentAttempt | null;
  replayed: boolean;
}> {
  const supabase = database();
  const { data, error } = await supabase.rpc("prepare_order", {
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
    p_items: input.items,
    p_payment_method: input.paymentMethod,
    p_address: input.address,
    p_service: input.service,
  });
  rpcError(error, "Failed to prepare order");

  const result = data as PrepareOrderResult | null;
  if (!result?.order) throw new Error("Order transaction returned no order");
  return {
    order: rowToOrder(result.order),
    paymentAttempt: result.paymentAttempt,
    replayed: result.replayed,
  };
}

export async function createOrder(
  userId: string,
  input: {
    items: Array<{ productId: string; quantity: number; variantId?: string }>;
    service: Order["service"];
    address: Order["address"];
    paymentMethod: Order["paymentMethod"];
    idempotencyKey: string;
    requestHash: string;
  }
): Promise<Order> {
  const prepared = await prepareOrder({ userId, ...input });
  if (input.paymentMethod !== "cod") {
    throw new Error("Online orders must be finalized through a payment attempt");
  }
  return prepared.order;
}

export async function bindGatewayOrder(input: {
  userId: string;
  orderId: string;
  paymentAttemptId: string;
  gatewayOrderId: string;
}) {
  const supabase = database();
  const { data, error } = await supabase.rpc("bind_gateway_order", {
    p_user_id: input.userId,
    p_order_id: input.orderId,
    p_payment_attempt_id: input.paymentAttemptId,
    p_gateway_order_id: input.gatewayOrderId,
  });
  rpcError(error, "Failed to bind gateway order");
  return data as PaymentAttempt;
}

export async function getPaymentAttemptForUser(input: {
  userId: string;
  orderId: string;
  paymentAttemptId: string;
}) {
  const supabase = database();
  const { data, error } = await supabase
    .from("order_payment_attempts")
    .select("*")
    .eq("id", input.paymentAttemptId)
    .eq("order_id", input.orderId)
    .eq("user_id", input.userId)
    .maybeSingle();
  rpcError(error, "Failed to load payment attempt");
  return (data as PaymentAttempt | null) ?? null;
}

export async function finalizeOrderPayment(input: {
  userId: string;
  orderId: string;
  paymentAttemptId: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  amountPaise: number;
}) {
  const supabase = database();
  const { data, error } = await supabase.rpc("finalize_order_payment", {
    p_user_id: input.userId,
    p_order_id: input.orderId,
    p_payment_attempt_id: input.paymentAttemptId,
    p_gateway_order_id: input.gatewayOrderId,
    p_gateway_payment_id: input.gatewayPaymentId,
    p_amount_paise: input.amountPaise,
  });
  rpcError(error, "Failed to finalize payment");
  return rowToOrder(data as DbOrderRow);
}

export async function getOrder(
  id: string,
  userId?: string
): Promise<Order | undefined> {
  const supabase = database();
  let query = supabase.from("orders").select("*").eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  rpcError(error, "Failed to load order");
  return data ? rowToOrder(data as DbOrderRow) : undefined;
}

export async function listOrders(userId?: string): Promise<Order[]> {
  if (!userId) return [];
  const supabase = database();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("placed_at", { ascending: false })
    .limit(100);
  rpcError(error, "Failed to load orders");
  return (data as DbOrderRow[]).map(rowToOrder);
}

export async function listAllOrders(): Promise<Order[]> {
  const supabase = database();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("placed_at", { ascending: false })
    .limit(500);
  rpcError(error, "Failed to load orders");
  return (data as DbOrderRow[]).map(rowToOrder);
}

export async function cancelOrder(
  id: string,
  actorId: string,
  reason = "",
  actorRole = "customer"
): Promise<Order> {
  const supabase = database();
  const { data, error } = await supabase.rpc("cancel_order", {
    p_order_id: id,
    p_actor_id: actorId,
    p_actor_role: actorRole,
    p_reason: reason,
  });
  rpcError(error, "Failed to cancel order");
  return rowToOrder(data as DbOrderRow);
}

export async function transitionOrderStatus(input: {
  orderId: string;
  nextStatus: OrderStatus;
  actorId?: string;
  actorRole: string;
  note?: string;
}) {
  const supabase = database();
  const { data, error } = await supabase.rpc("transition_order_status", {
    p_order_id: input.orderId,
    p_next_status: input.nextStatus,
    p_actor_id: input.actorId ?? null,
    p_actor_role: input.actorRole,
    p_note: input.note ?? "",
  });
  rpcError(error, "Failed to transition order");
  return rowToOrder(data as DbOrderRow);
}

export async function updateOrderTracking(
  id: string,
  tracking: Partial<Order["tracking"]>,
  riderId?: string,
  source: "rider_app" | "admin" | "location_api" = "rider_app"
) {
  if (tracking?.riderLat == null || tracking.riderLng == null) {
    throw new Error("Tracking coordinates are required");
  }
  const supabase = database();
  const { data, error } = await supabase.rpc("persist_order_tracking", {
    p_order_id: id,
    p_rider_id: riderId ?? null,
    p_latitude: tracking.riderLat,
    p_longitude: tracking.riderLng,
    p_accuracy: null,
    p_speed: tracking.riderSpeed ?? null,
    p_heading: tracking.riderHeading ?? null,
    p_source: source,
    p_metadata: {
      riderName: tracking.riderName,
      riderPhone: tracking.riderPhone,
    },
  });
  rpcError(error, "Failed to persist tracking");
  const payload: RiderLocationUpdate = {
    orderId: id,
    lat: tracking.riderLat,
    lng: tracking.riderLng,
    speed: tracking.riderSpeed,
    heading: tracking.riderHeading,
    timestamp: tracking.updatedAt ?? new Date().toISOString(),
    riderName: tracking.riderName,
    riderPhone: tracking.riderPhone,
    etaMinutes: tracking.etaMinutes,
    distanceKm: tracking.distanceKm,
    distanceRemainingM: tracking.distanceRemainingM,
  };
  const redis = getRedisCommand();
  if (redis) {
    await redis.set(
      redisKey("tracking-state", "order", id),
      JSON.stringify(payload),
      "EX",
      300
    );
  }
  await publishRiderLocation(id, payload);
  return (data as RiderLocationUpdate) ?? payload;
}
