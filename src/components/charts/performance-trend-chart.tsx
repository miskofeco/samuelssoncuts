"use client";

import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type PerformanceMetric = "bookings" | "bookingValue";

export function PerformanceTrendChart({
  data,
  metric,
  bookingsLabel,
  bookingValueLabel,
  locale,
}: {
  data: { label: string; bookings: number; bookingValue: number }[];
  metric: PerformanceMetric;
  bookingsLabel: string;
  bookingValueLabel: string;
  locale: string;
}) {
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const chartConfig = {
    bookings: {
      label: bookingsLabel,
      color: "var(--chart-2)",
    },
    bookingValue: {
      label: bookingValueLabel,
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;
  const isValue = metric === "bookingValue";
  const formatValue = (value: number) =>
    isValue ? currency.format(value) : integer.format(value);

  return (
    <ChartContainer
      config={chartConfig}
      className="h-full w-full aspect-auto"
      aria-label={`${chartConfig[metric].label}: ${data.map((item) => `${item.label} ${formatValue(item[metric])}`).join(", ")}`}
      role="img"
    >
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bookingValueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-bookingValue)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--color-bookingValue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={18}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={isValue ? 54 : 34}
          tickFormatter={(value: number) =>
            isValue ? currency.format(value).replace(/\s/g, "") : integer.format(value)
          }
        />
        <ChartTooltip
          cursor={isValue ? { stroke: "var(--border)", strokeDasharray: "3 3" } : false}
          content={
            <ChartTooltipContent
              indicator={isValue ? "line" : "dot"}
              formatter={(value) => (
                <div className="flex min-w-36 items-center justify-between gap-4">
                  <span className="text-muted-foreground">{chartConfig[metric].label}</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {formatValue(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        {isValue ? (
          <Area
            type="monotone"
            dataKey="bookingValue"
            stroke="var(--color-bookingValue)"
            strokeWidth={2.5}
            fill="url(#bookingValueFill)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            animationDuration={450}
          />
        ) : (
          <Bar
            dataKey="bookings"
            fill="var(--color-bookings)"
            radius={[7, 7, 2, 2]}
            maxBarSize={56}
            activeBar={{ fillOpacity: 0.78 }}
            animationDuration={450}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
