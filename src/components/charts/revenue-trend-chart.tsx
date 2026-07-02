"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Revenue per month (euros). Mirrors BookingsTrendChart but formats the axis and
// tooltip as currency.
export function RevenueTrendChart({
  data,
}: {
  data: { label: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.6 }} />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }}
          tickFormatter={(v: number) => `${v} €`}
        />
        <Tooltip
          cursor={{ stroke: "currentColor", strokeOpacity: 0.15 }}
          formatter={(value) => [`${value} €`, ""]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(120,120,120,0.2)",
            background: "var(--surface)",
            color: "var(--foreground)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="currentColor"
          strokeWidth={2}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
