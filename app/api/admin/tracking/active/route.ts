import { NextResponse } from "next/server";
import { requireAdminAuth, adminErrorResponse } from "@/lib/admin/auth";
import { canRead } from "@/lib/admin/rbac";
import { listAllOrders } from "@/lib/server/orders";

export async function GET() {
  try {
    const ctx = await requireAdminAuth();
    if (!canRead(ctx.permissions, "tracking")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orders = await listAllOrders();
    const active = orders.filter((o) =>
      ["assigned", "picked", "in_transit", "preparing", "packed"].includes(
        o.status
      )
    );

    return NextResponse.json({ orders: active });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
