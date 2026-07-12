"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Navigation, Phone, Store, User } from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { LiveTrackingMap } from "@/components/tracking/LiveTrackingMap";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { useLiveOrderTracking } from "@/lib/hooks/useLiveOrderTracking";
import type { Order } from "@/lib/types";
import { formatINR } from "@/lib/utils";

type TrackingPayload = {
  order: Order;
  customer: { id: string; name: string; email?: string; phone?: string } | null;
  vendor: { name: string; lat: number | null; lng: number | null };
  rider: {
    name: string | null;
    phone: string | null;
    rating: number | null;
    lat: number | null;
    lng: number | null;
  };
  timeline: Array<{ status: string; label: string; note: string; created_at: string }>;
  etaMinutes: number | null;
  distanceRemainingM: number | null;
  distanceKm: number | null;
};

function TrackingView({ data }: { data: TrackingPayload }) {
  const { order } = data;
  const { location, connected, transport } = useLiveOrderTracking(order.id, order.tracking);

  const riderLat = location?.lat ?? data.rider.lat ?? order.tracking?.riderLat;
  const riderLng = location?.lng ?? data.rider.lng ?? order.tracking?.riderLng;
  const eta = location?.etaMinutes ?? data.etaMinutes;
  const remaining =
    location?.distanceRemainingM ?? data.distanceRemainingM ?? null;

  return (
    <div className="flex flex-col gap-4 lg:gap-6 xl:grid xl:grid-cols-[1.4fr_1fr]">
      {/* Map — full-bleed feel on mobile */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-none border-y border-gray-100 bg-white shadow-card sm:rounded-2xl sm:border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                Live map
              </p>
              <h2 className="text-lg font-bold text-ink">Order #{order.id}</h2>
            </div>
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  connected
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-ink-muted"
                }`}
              >
                {connected ? `Live · ${transport ?? "stream"}` : "Reconnecting…"}
              </span>
            </div>
          </div>
          <LiveTrackingMap
            className="h-[min(55dvh,28rem)] w-full sm:h-[420px]"
            status={order.status}
            showRoute
            rider={
              riderLat && riderLng
                ? {
                    orderId: order.id,
                    lat: riderLat,
                    lng: riderLng,
                    riderName: location?.riderName ?? data.rider.name ?? undefined,
                    riderPhone: location?.riderPhone ?? data.rider.phone ?? undefined,
                    etaMinutes: eta ?? undefined,
                    distanceRemainingM: remaining ?? undefined,
                    heading: location?.heading,
                    speed: location?.speed,
                    timestamp: location?.timestamp,
                  }
                : null
            }
            store={
              data.vendor.lat && data.vendor.lng
                ? {
                    lat: data.vendor.lat,
                    lng: data.vendor.lng,
                    name: data.vendor.name,
                  }
                : order.tracking?.storeLat && order.tracking?.storeLng
                  ? {
                      lat: order.tracking.storeLat,
                      lng: order.tracking.storeLng,
                      name: order.tracking.storeName,
                    }
                  : undefined
            }
            customer={
              order.tracking?.customerLat && order.tracking?.customerLng
                ? {
                    lat: order.tracking.customerLat,
                    lng: order.tracking.customerLng,
                  }
                : order.address?.latitude && order.address?.longitude
                  ? {
                      lat: order.address.latitude,
                      lng: order.address.longitude,
                    }
                  : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 px-0 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
            <p className="text-xs text-ink-soft">ETA</p>
            <p className="mt-1 text-xl font-bold text-ink">
              {eta != null ? `${Math.round(eta)} min` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
            <p className="text-xs text-ink-soft">Distance remaining</p>
            <p className="mt-1 text-xl font-bold text-ink">
              {remaining != null
                ? remaining >= 1000
                  ? `${(remaining / 1000).toFixed(1)} km`
                  : `${Math.round(remaining)} m`
                : data.distanceKm != null
                  ? `${data.distanceKm.toFixed(1)} km`
                  : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
            <p className="text-xs text-ink-soft">Payment</p>
            <p className="mt-1 text-xl font-bold capitalize text-ink">
              {order.paymentStatus ?? "pending"}
            </p>
          </div>
        </div>
      </div>

      {/* Info panel — stacks below map on mobile */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
            <User className="h-4 w-4 text-brand-primary" /> Customer
          </h3>
          <p className="font-medium text-ink">{data.customer?.name ?? order.address?.fullName ?? "—"}</p>
          <p className="text-sm text-ink-muted">{data.customer?.email ?? "—"}</p>
          <p className="text-sm text-ink-muted">{data.customer?.phone ?? order.address?.phone ?? "—"}</p>
          <p className="mt-2 text-sm text-ink-muted">
            {[order.address?.line1, order.address?.city, order.address?.pincode]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
            <Store className="h-4 w-4 text-brand-primary" /> Vendor
          </h3>
          <p className="font-medium text-ink">{data.vendor.name}</p>
          {data.vendor.lat && data.vendor.lng && (
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
              <MapPin className="h-3 w-3" />
              {data.vendor.lat.toFixed(4)}, {data.vendor.lng.toFixed(4)}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
            <Navigation className="h-4 w-4 text-brand-primary" /> Rider
          </h3>
          <p className="font-medium text-ink">
            {location?.riderName ?? data.rider.name ?? "Unassigned"}
          </p>
          {(location?.riderPhone ?? data.rider.phone) && (
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              <Phone className="h-3.5 w-3.5" />
              {location?.riderPhone ?? data.rider.phone}
            </p>
          )}
          {(location?.riderRating ?? data.rider.rating) != null && (
            <p className="text-sm text-ink-muted">
              Rating {location?.riderRating ?? data.rider.rating}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink">Order summary</h3>
            <AdminStatusBadge status={order.paymentStatus ?? "pending"} />
          </div>
          <p className="text-sm text-ink-muted">
            {order.items.length} items · {formatINR(order.total)} ·{" "}
            {order.paymentMethod.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Placed {new Date(order.placedAt).toLocaleString("en-IN")}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
          <h3 className="mb-4 font-semibold text-ink">Timeline</h3>
          <ol className="relative space-y-4 border-l border-gray-200 pl-4">
            {data.timeline.map((event, i) => (
              <li key={`${event.status}-${event.created_at}-${i}`} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-primary" />
                <p className="text-sm font-medium capitalize text-ink">
                  {event.label || event.status.replace(/_/g, " ")}
                </p>
                {event.note && <p className="text-xs text-ink-muted">{event.note}</p>}
                <p className="text-xs text-ink-soft">
                  {new Date(event.created_at).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrderTrackingPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const [data, setData] = useState<TrackingPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    const load = () =>
      fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/tracking`)
        .then(async (r) => {
          const json = await r.json();
          if (!r.ok) throw new Error(json.error ?? "Failed to load tracking");
          return json as TrackingPayload;
        })
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : "Failed");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [orderId]);

  return (
    <AdminPageShell
      title="Order Live Tracking"
      subtitle="Admin-only delivery map, ETA, and status timeline"
    >
      <div className="mb-4">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>
      </div>

      {loading ? (
        <AdminTableSkeleton rows={4} cols={3} />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : data ? (
        <TrackingView data={data} />
      ) : null}
    </AdminPageShell>
  );
}
