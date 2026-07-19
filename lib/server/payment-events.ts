import type { PaymentAttempt } from "@/lib/server/orders";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";

export type PaymentWebhookEvent = {
  event_id: string;
  event_type: string;
  processing_status: "received" | "processed" | "unmatched" | "failed";
  processing_attempts: number;
};

function database() {
  if (!hasAdminClient()) {
    throw new Error("Durable payment database is not configured");
  }
  return createAdminClient();
}

export async function recordPaymentWebhook(input: {
  eventId: string;
  eventType: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  gatewayRefundId?: string | null;
  payload: unknown;
}) {
  const { data, error } = await database().rpc("record_payment_webhook", {
    p_event_id: input.eventId,
    p_event_type: input.eventType,
    p_gateway_order_id: input.gatewayOrderId ?? null,
    p_gateway_payment_id: input.gatewayPaymentId ?? null,
    p_gateway_refund_id: input.gatewayRefundId ?? null,
    p_payload: input.payload,
  });
  if (error) throw new Error(error.message);
  return data as PaymentWebhookEvent;
}

export async function updatePaymentWebhookStatus(
  eventId: string,
  status: "processed" | "unmatched" | "failed",
  errorMessage?: string
) {
  const { data, error } = await database().rpc(
    "update_payment_webhook_status",
    {
      p_event_id: eventId,
      p_status: status,
      p_error: errorMessage ?? null,
    }
  );
  if (error) throw new Error(error.message);
  return data as PaymentWebhookEvent;
}

export async function getPaymentAttemptByGatewayOrder(gatewayOrderId: string) {
  const { data, error } = await database()
    .from("order_payment_attempts")
    .select("*")
    .eq("gateway_order_id", gatewayOrderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PaymentAttempt | null) ?? null;
}

export async function markPaymentAttemptFailed(input: {
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  failureCode?: string;
  failureReason?: string;
}) {
  const { data, error } = await database().rpc("mark_payment_attempt_failed", {
    p_gateway_order_id: input.gatewayOrderId,
    p_gateway_payment_id: input.gatewayPaymentId ?? null,
    p_failure_code: input.failureCode ?? null,
    p_failure_reason: input.failureReason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as PaymentAttempt;
}
