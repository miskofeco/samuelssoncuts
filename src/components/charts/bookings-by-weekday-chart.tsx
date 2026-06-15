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

export function BookingsByWeekdayChart({
  data,
}: {
  data: { label: string; bookings: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.6 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.6 }} />
        <Tooltip
          cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(120,120,120,0.2)",
            background: "var(--surface)",
            color: "var(--foreground)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="bookings" fill="currentColor" radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
