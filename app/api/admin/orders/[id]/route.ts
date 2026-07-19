import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/admin/auth";
import {
  getOrder,
  transitionOrderStatus,
  updateOrderTracking,
} from "@/lib/server/orders";
import type { OrderStatus } from "@/lib/types";
import { z } from "zod";

const patchSchema = z.object({
  status: z
    .enum([
      "pending", "confirmed", "preparing", "packed", "assigned", "picked",
      "in_transit", "delivered", "cancelled", "returned", "refunded", "exchanged",
    ])
    .optional(),
  refundStatus: z
    .enum(["none", "requested", "processing", "completed"])
    .optional(),
  refundAmount: z.number().optional(),
  riderName: z.string().optional(),
  riderPhone: z.string().optional(),
  riderLat: z.number().optional(),
  riderLng: z.number().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    }

    const patch = parsed.data;
    if (patch.refundStatus != null || patch.refundAmount != null) {
      return NextResponse.json(
        { error: "Use the refunds endpoint for refund state changes" },
        { status: 409 }
      );
    }

    let order = await getOrder(params.id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (patch.status && patch.status !== order.status) {
      order = await transitionOrderStatus({
        orderId: params.id,
        nextStatus: patch.status as OrderStatus,
        actorId: admin.id,
        actorRole: "admin",
      });
    }

    if (patch.riderLat != null && patch.riderLng != null) {
      await updateOrderTracking(
        params.id,
        {
        riderName: patch.riderName,
        riderPhone: patch.riderPhone,
        riderLat: patch.riderLat,
        riderLng: patch.riderLng,
        },
        admin.id,
        "admin"
      );
      order = (await getOrder(params.id)) ?? order;
    }

    return NextResponse.json({ order });
  } catch (e) {
    return adminErrorResponse(e);
  }
}
