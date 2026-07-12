"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { ChartDataPoint } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const COLORS = ["#FF6B00", "#E63946", "#2ECC71", "#3498DB", "#9B59B6", "#F39C12", "#1ABC9C", "#E74C3C"];

interface ChartCardProps {
  title: string;
  data: ChartDataPoint[];
  type?: "area" | "bar" | "pie";
  valuePrefix?: string;
  className?: string;
  heightClassName?: string;
}

export function ChartCard({
  title,
  data,
  type = "area",
  valuePrefix = "",
  className,
  heightClassName = "h-52 sm:h-56 lg:h-64",
}: ChartCardProps) {
  const formatValue = (v: unknown) => {
    const n = typeof v === "number" ? v : 0;
    return valuePrefix === "₹" ? `₹${n.toLocaleString("en-IN")}` : n.toLocaleString("en-IN");
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-100 bg-white p-4 shadow-card sm:p-5",
        className
      )}
    >
      <h3 className="mb-3 text-sm font-semibold text-ink sm:mb-4">{title}</h3>
      <div className={cn("w-full min-w-0", heightClassName)}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {type === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="45%"
                outerRadius="70%"
                label={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatValue(v)} />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          ) : type === "bar" ? (
            <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip formatter={(v) => formatValue(v)} />
              <Bar dataKey="value" fill="#FF6B00" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip formatter={(v) => formatValue(v)} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#FF6B00"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
