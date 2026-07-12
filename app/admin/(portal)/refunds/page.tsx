"use client";

import { useEffect, useState } from "react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminCardSkeleton } from "@/components/admin/AdminTableSkeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatINR } from "@/lib/utils";
import { toast } from "@/lib/stores/toast";
import type { Order } from "@/lib/types";

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    fetch("/api/admin/refunds")
      .then((r) => r.json())
      .then((d) => setRefunds(d.refunds ?? []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const process = async (orderId: string, action: string, amount?: number) => {
    const res = await fetch("/api/admin/refunds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action, amount }),
    });
    if (res.ok) {
      toast.success(`Refund ${action}`);
      load();
    } else {
      toast.error("Action failed");
    }
  };

  return (
    <AdminPageShell title="Refund Management" subtitle="Process and track refund requests">
      {loading ? (
        <AdminCardSkeleton count={3} />
      ) : refunds.length === 0 ? (
        <p className="text-ink-muted">No refund requests.</p>
      ) : (
        <div className="space-y-4">
          {refunds.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-ink">Order #{o.id}</p>
                  <p className="text-sm text-ink-muted">
                    {formatINR(o.total)} · {o.paymentMethod.toUpperCase()}
                  </p>
                </div>
                <Badge tone={o.refundStatus === "requested" ? "red" : "orange"}>
                  {o.refundStatus}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {o.refundStatus === "requested" && (
                  <>
                    <Button
                      size="md"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => process(o.id, "approve", o.total)}
                    >
                      Approve Full
                    </Button>
                    <Button
                      size="md"
                      variant="outline"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => process(o.id, "partial", o.total * 0.5)}
                    >
                      Partial 50%
                    </Button>
                    <Button
                      size="md"
                      variant="outline"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => process(o.id, "reject")}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {o.refundStatus === "processing" && (
                  <Button
                    size="md"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => process(o.id, "complete")}
                  >
                    Mark Completed
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}
