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
  const accent = "currentColor";
  const grid = "#e7e5e4";

  return (
    <div className="h-full text-stone-950 dark:text-white">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} strokeOpacity={0.8} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#78716c" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 12, fill: "#78716c" }} />
          <Tooltip
            cursor={{ stroke: accent, strokeOpacity: 0.2 }}
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
            dataKey="bookings"
            stroke={accent}
            strokeWidth={2}
            fill="url(#bookingsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
