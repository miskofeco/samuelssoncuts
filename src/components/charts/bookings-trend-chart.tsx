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

import { chartTooltipStyle } from "./chart-theme";

// Monochrome area chart: the stroke/fill follow `currentColor` so the parent
// ChartCard's `text-foreground` drives both themes.
export function BookingsTrendChart({
  data,
}: {
  data: { label: string; bookings: number }[];
}) {
  const accent = "currentColor";

  return (
    <div className="h-full text-foreground">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={28}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <Tooltip cursor={{ stroke: accent, strokeOpacity: 0.2 }} contentStyle={chartTooltipStyle} />
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
