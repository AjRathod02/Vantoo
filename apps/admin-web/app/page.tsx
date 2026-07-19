import Link from "next/link";

async function getStats() {
  try {
    const [ordersRes, productsRes] = await Promise.all([
      fetch("http://localhost:3000/api/admin/orders", { cache: "no-store" }),
      fetch("http://localhost:3000/api/admin/products", { cache: "no-store" }),
    ]);
    const orders = ordersRes.ok ? ((await ordersRes.json()).orders ?? []) : [];
    const products = productsRes.ok ? ((await productsRes.json()).products ?? []) : [];
    const ongoing = orders.filter(
      (o: { status: string }) => !["delivered", "cancelled"].includes(o.status)
    ).length;
    const revenue = orders
      .filter(
        (o: { paymentStatus?: string; paymentMethod?: string }) =>
          o.paymentStatus === "paid" || o.paymentMethod === "cod"
      )
      .reduce((sum: number, o: { total: number }) => sum + o.total, 0);
    return { orderCount: orders.length, productCount: products.length, ongoing, revenue };
  } catch {
    return { orderCount: 0, productCount: 0, ongoing: 0, revenue: 0 };
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats();
  const cards = [
    { label: "Products", value: stats.productCount },
    { label: "Orders", value: stats.orderCount },
    { label: "Ongoing", value: stats.ongoing },
    { label: "Revenue (₹)", value: stats.revenue.toLocaleString("en-IN") },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">
          Lightweight admin shell on :3001 that proxies{" "}
          <code className="text-xs">/api/*</code> to the Next.js backend (
          {process.env.API_BASE_URL ?? "http://localhost:3000"}). For full RBAC,
          login, refunds, and live tracking use the primary portal at{" "}
          <a className="text-orange-600 underline" href="http://localhost:3000/admin">
            localhost:3000/admin
          </a>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/products" className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md">
          <h2 className="font-bold">Manage Products</h2>
          <p className="mt-1 text-sm text-gray-500">Catalog, pricing, inventory.</p>
        </Link>
        <Link href="/orders" className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md">
          <h2 className="font-bold">Manage Orders</h2>
          <p className="mt-1 text-sm text-gray-500">Live orders, refunds, tracking.</p>
        </Link>
      </div>
    </div>
  );
}
