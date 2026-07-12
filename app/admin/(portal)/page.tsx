"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Store,
  Bike,
  Package,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
  Headphones,
  Star,
  IndianRupee,
} from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { StatCard } from "@/components/admin/StatCard";
import { ChartCard } from "@/components/admin/ChartCard";
import { AdminCardSkeleton } from "@/components/admin/AdminTableSkeleton";
import type { DashboardStats, ChartDataPoint } from "@/lib/admin/types";
import { formatINR } from "@/lib/utils";

const STAT_GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-6";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<{
    revenue: ChartDataPoint[];
    orders: ChartDataPoint[];
    salesByCategory: ChartDataPoint[];
    customerGrowth: ChartDataPoint[];
    refundTrends: ChartDataPoint[];
    cancellationTrends: ChartDataPoint[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setStats(d.stats);
        setCharts(d.charts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <AdminPageShell title="Dashboard" subtitle="Loading analytics...">
        <div className="space-y-6" aria-busy="true" aria-live="polite">
          <AdminCardSkeleton count={6} />
          <AdminCardSkeleton count={4} />
        </div>
      </AdminPageShell>
    );
  }

  const s = stats!;

  return (
    <AdminPageShell
      title="Dashboard"
      subtitle="Real-time business analytics and platform overview"
    >
      <div className="space-y-6">
        <section aria-label="User metrics">
          <div className={STAT_GRID}>
            <StatCard label="Total Customers" value={s.totalCustomers} icon={Users} />
            <StatCard label="Total Vendors" value={s.totalVendors} icon={Store} />
            <StatCard label="Total Riders" value={s.totalRiders} icon={Bike} />
            <StatCard label="Active Users" value={s.activeUsers} icon={Users} />
            <StatCard label="Pending Vendors" value={s.pendingVendorApprovals} icon={AlertCircle} />
            <StatCard label="Pending Riders" value={s.pendingRiderApprovals} icon={AlertCircle} />
          </div>
        </section>

        <section aria-label="Catalog and orders">
          <div className={STAT_GRID}>
            <StatCard label="Total Products" value={s.totalProducts} icon={Package} />
            <StatCard label="Out of Stock" value={s.outOfStockProducts} icon={Package} />
            <StatCard label="Today's Orders" value={s.todayOrders} icon={ShoppingBag} />
            <StatCard label="Pending Orders" value={s.pendingOrders} icon={ShoppingBag} />
            <StatCard label="Completed" value={s.completedOrders} icon={ShoppingBag} />
            <StatCard label="Cancelled" value={s.cancelledOrders} icon={ShoppingBag} />
          </div>
        </section>

        <section aria-label="Revenue">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Revenue" value={formatINR(s.totalRevenue)} icon={IndianRupee} />
            <StatCard label="Today's Revenue" value={formatINR(s.todayRevenue)} icon={TrendingUp} />
            <StatCard label="Weekly Revenue" value={formatINR(s.weeklyRevenue)} icon={TrendingUp} />
            <StatCard label="Monthly Revenue" value={formatINR(s.monthlyRevenue)} icon={TrendingUp} />
          </div>
        </section>

        <section aria-label="Operations">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Refund Requests" value={s.refundRequests} icon={AlertCircle} />
            <StatCard label="Support Tickets" value={s.supportTickets} icon={Headphones} />
            <StatCard
              label="Satisfaction"
              value={`${s.customerSatisfaction}/5`}
              icon={Star}
            />
            <StatCard label="Active Coupons" value={s.activeCoupons} icon={TrendingUp} />
          </div>
        </section>

        {charts && (
          <section aria-label="Analytics charts" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue (Last 7 Days)" data={charts.revenue} valuePrefix="₹" />
            <ChartCard title="Orders (Last 7 Days)" data={charts.orders} type="bar" />
            <ChartCard title="Sales by Category" data={charts.salesByCategory} type="pie" />
            <ChartCard title="Customer Growth" data={charts.customerGrowth} type="bar" />
            <ChartCard title="Refund Trends" data={charts.refundTrends} type="bar" />
            <ChartCard title="Cancellation Trends" data={charts.cancellationTrends} type="bar" />
          </section>
        )}
      </div>
    </AdminPageShell>
  );
}
