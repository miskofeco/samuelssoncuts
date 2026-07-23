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
  const accent = "#ffad4f";
  const grid = "#e7e5e4";

  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.32} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} strokeOpacity={0.8} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#78716c" }} />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fontSize: 12, fill: "#78716c" }}
          tickFormatter={(v: number) => `${v} €`}
        />
        <Tooltip
          cursor={{ stroke: accent, strokeOpacity: 0.2 }}
          formatter={(value) => [`${value} €`, ""]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid rgba(120,120,120,0.2)",
            background: "var(--surface)",
            color: "var(--foreground)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={accent}
          strokeWidth={2}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
