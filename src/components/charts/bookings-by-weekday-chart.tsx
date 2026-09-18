"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/shared/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export function BookingsByWeekdayChart({
  data,
  bookingsLabel,
  emptyTitle,
  emptyDescription,
}: {
  data: { label: string; bookings: number }[];
  bookingsLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const total = data.reduce((sum, item) => sum + item.bookings, 0);
  const chartConfig = {
    bookings: {
      label: bookingsLabel,
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  if (total === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="h-full border-0 bg-transparent py-6"
      />
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="h-full w-full aspect-auto"
      aria-label={data.map((item) => `${item.label}: ${item.bookings}`).join(", ")}
      role="img"
    >
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel indicator="dot" />}
        />
        <Bar
          dataKey="bookings"
          fill="var(--color-bookings)"
          radius={[6, 6, 2, 2]}
          maxBarSize={42}
          activeBar={{ fillOpacity: 0.75 }}
        />
      </BarChart>
    </ChartContainer>
  );
}
