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

export function BookingsTrendChart({
  data,
}: {
  data: { label: string; bookings: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.6 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 12, fill: "currentColor", opacity: 0.6 }} />
        <Tooltip
          cursor={{ stroke: "currentColor", strokeOpacity: 0.15 }}
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
          dataKey="bookings"
          stroke="currentColor"
          strokeWidth={2}
          fill="url(#bookingsFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
