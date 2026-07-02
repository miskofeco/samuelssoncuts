"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Horizontal bars so long service names stay readable; euros on the value axis.
export function RevenueByServiceChart({
  data,
  emptyLabel,
}: {
  data: { label: string; revenue: number }[];
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }}
          tickFormatter={(v: number) => `${v} €`}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={110}
          tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }}
        />
        <Tooltip
          cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
          formatter={(value) => [`${value} €`, ""]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(120,120,120,0.2)",
            background: "var(--surface)",
            color: "var(--foreground)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="revenue" fill="currentColor" radius={[0, 6, 6, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
