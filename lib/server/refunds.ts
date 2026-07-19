import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";

export type RefundAttempt = {
  id: string;
  order_id: string;
  payment_attempt_id: string;
  amount_paise: number;
  status: "requested" | "processing" | "completed" | "failed" | "cancelled";
  idempotency_key: string;
  gateway_refund_id: string | null;
};

function database() {
  if (!hasAdminClient()) {
    throw new Error("Durable refund database is not configured");
  }
  return createAdminClient();
}

export async function prepareRefundAttempt(input: {
  orderId: string;
  requestedBy: string;
  amountPaise: number;
  reason: string;
  idempotencyKey: string;
}) {
  const { data, error } = await database().rpc("prepare_refund_attempt", {
    p_order_id: input.orderId,
    p_requested_by: input.requestedBy,
    p_amount_paise: input.amountPaise,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data as RefundAttempt;
}

export async function bindGatewayRefund(
  refundAttemptId: string,
  gatewayRefundId: string
) {
  const { data, error } = await database().rpc("bind_gateway_refund", {
    p_refund_attempt_id: refundAttemptId,
    p_gateway_refund_id: gatewayRefundId,
  });
  if (error) throw new Error(error.message);
  return data as RefundAttempt;
}

export async function completeGatewayRefund(
  gatewayRefundId: string,
  amountPaise: number
) {
  const { data, error } = await database().rpc("complete_gateway_refund", {
    p_gateway_refund_id: gatewayRefundId,
    p_amount_paise: amountPaise,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function markGatewayRefundFailed(
  gatewayRefundId: string,
  failureReason: string
) {
  const { data, error } = await database().rpc("mark_gateway_refund_failed", {
    p_gateway_refund_id: gatewayRefundId,
    p_failure_reason: failureReason,
  });
  if (error) throw new Error(error.message);
  return data as RefundAttempt;
}
