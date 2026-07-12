"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminFilterBar } from "@/components/admin/AdminFilterBar";
import { AdminCardSkeleton, AdminTableSkeleton } from "@/components/admin/AdminTableSkeleton";
import type { LocationRole, Order } from "@/lib/types";
import { LiveTrackingMap } from "@/components/tracking/LiveTrackingMap";
import { FleetLiveMap } from "@/components/location/FleetLiveMap";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { LocationStatusBadge } from "@/components/location/LocationStatusBadge";
import { useLiveOrderTracking } from "@/lib/hooks/useLiveOrderTracking";
import { useLiveUserLocations } from "@/lib/hooks/useLiveUserLocations";

const ROLES: Array<LocationRole | "all"> = ["all", "customer", "rider", "vendor"];

function ActiveOrderCard({ order }: { order: Order }) {
  const { location, connected } = useLiveOrderTracking(order.id, order.tracking);

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-bold text-ink">#{order.id}</p>
          <p className="text-xs text-ink-muted">
            {order.tracking?.riderName ?? "Unassigned"}
            {order.address?.city ? ` · ${order.address.city}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <OrderStatusBadge status={order.status} />
          <span
            className={`text-[10px] font-semibold ${
              connected ? "text-green-600" : "text-ink-soft"
            }`}
          >
            {connected ? "Live GPS" : "Polling"}
          </span>
        </div>
      </div>
      <LiveTrackingMap
        className="h-56"
        status={order.status}
        showRoute
        rider={location}
        store={
          order.tracking?.storeLat && order.tracking?.storeLng
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
            : undefined
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          ETA{" "}
          {location?.etaMinutes != null
            ? `${Math.round(location.etaMinutes)} min`
            : order.tracking?.etaMinutes != null
              ? `${Math.round(order.tracking.etaMinutes)} min`
              : "—"}
        </span>
        <Link
          href={`/admin/orders/${order.id}/tracking`}
          className="text-sm font-semibold text-brand-primary hover:underline"
        >
          Open tracking →
        </Link>
      </div>
    </div>
  );
}

function LiveTrackingContent() {
  const searchParams = useSearchParams();
  const riderFilterParam = searchParams.get("rider") ?? "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<LocationRole | "all">("all");
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [search, setSearch] = useState(riderFilterParam);
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const { locations, connected } = useLiveUserLocations({
    scope: "admin",
    role: roleFilter === "all" ? undefined : roleFilter,
    online: onlineOnly,
  });

  const fleetLocations = useMemo(() => {
    let list = roleFilter === "all" ? locations : locations.filter((l) => l.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.userId.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.orderId?.toLowerCase().includes(q)
      );
    }
    if (cityFilter) {
      list = list.filter((l) => l.city?.toLowerCase().includes(cityFilter.toLowerCase()));
    }
    return list;
  }, [locations, roleFilter, search, cityFilter]);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (cityFilter && !o.address?.city?.toLowerCase().includes(cityFilter.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.tracking?.riderName?.toLowerCase().includes(q) ||
        o.tracking?.storeName?.toLowerCase().includes(q) ||
        o.address?.fullName?.toLowerCase().includes(q) ||
        o.address?.city?.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter, cityFilter]);

  useEffect(() => {
    const load = () =>
      fetch("/api/admin/tracking/active")
        .then((r) => r.json())
        .then((d) => setOrders(d.orders ?? []))
        .finally(() => setLoading(false));

    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      if (o.address?.city) set.add(o.address.city);
    }
    for (const l of locations) {
      if (l.city) set.add(l.city);
    }
    return [...set].sort();
  }, [orders, locations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminFilterBar
          className="flex-1"
          search={search}
          onSearchChange={setSearch}
          placeholder="Filter by rider, vendor, customer, order ID…"
          filters={[
            {
              key: "status",
              label: "Delivery",
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: "", label: "All" },
                { value: "assigned", label: "Assigned" },
                { value: "picked", label: "Picked" },
                { value: "in_transit", label: "In transit" },
                { value: "packed", label: "Packed" },
                { value: "preparing", label: "Preparing" },
              ],
            },
          ]}
        />
        <div className="flex items-center gap-2">
          <LocationStatusBadge />
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              connected
                ? "bg-brand-accent/15 text-brand-accent"
                : "bg-gray-100 text-ink-muted"
            }`}
          >
            {connected ? "WebSocket live" : "Connecting…"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            className={`min-h-11 rounded-xl px-3.5 text-sm font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
              roleFilter === role
                ? "bg-brand-primary text-white"
                : "bg-gray-100 text-ink-muted"
            }`}
          >
            {role}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOnlineOnly((v) => !v)}
          className={`min-h-11 rounded-xl px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
            onlineOnly
              ? "bg-brand-accent/15 text-brand-accent"
              : "bg-gray-100 text-ink-muted"
          }`}
        >
          {onlineOnly ? "Online only" : "All users"}
        </button>
        {cities.length > 0 && (
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="min-h-11 rounded-xl border-0 bg-gray-100 px-3 text-sm text-ink-muted"
            aria-label="Filter by city"
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      <FleetLiveMap
        locations={fleetLocations}
        className="h-[min(50dvh,24rem)] overflow-hidden rounded-2xl border border-gray-100 shadow-card sm:h-[28rem]"
      />

      <div>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-ink">
            Active deliveries ({filteredOrders.length})
          </h2>
          <p className="text-xs text-ink-soft">Auto-refresh every 8s · tap for detail</p>
        </div>
        {loading ? (
          <AdminCardSkeleton count={2} />
        ) : filteredOrders.length === 0 ? (
          <p className="text-ink-muted">No active deliveries match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredOrders.map((order) => (
              <ActiveOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminLiveTrackingPage() {
  return (
    <AdminPageShell
      title="Live Tracking"
      subtitle="Active deliveries, live rider GPS, vendor & customer pins, ETA and routes"
    >
      <Suspense fallback={<AdminTableSkeleton rows={4} cols={3} />}>
        <LiveTrackingContent />
      </Suspense>
    </AdminPageShell>
  );
}
