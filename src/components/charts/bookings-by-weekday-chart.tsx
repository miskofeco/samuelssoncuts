"use client";

import { MetricBarChart } from "./metric-bar-chart";

export function BookingsByWeekdayChart({
  data,
}: {
  data: { label: string; bookings: number }[];
}) {
  return (
    <MetricBarChart
      items={data.map((item) => ({
        key: item.label,
        label: item.label,
        value: item.bookings,
        valueLabel: String(item.bookings),
        ariaLabel: `${item.label}: ${item.bookings} bookings`,
      }))}
    />
  );
}
