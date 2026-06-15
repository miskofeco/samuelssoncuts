"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { ChartCard } from "@/components/charts/chart-card";
import {
  bookingsByWeekday,
  bookingsTrend,
  requestsByStatus,
} from "@/domain/analytics";
import type { Appointment, BookingRequest } from "@/domain/types";

// Recharts measures its container, so render client-only to avoid
// width(-1)/height(-1) warnings during SSR/hydration.
const chartLoading = () => (
  <div className="h-full w-full animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
);

const BookingsTrendChart = dynamic(
  () => import("@/components/charts/bookings-trend-chart").then((m) => m.BookingsTrendChart),
  { ssr: false, loading: chartLoading },
);
const BookingsByWeekdayChart = dynamic(
  () =>
    import("@/components/charts/bookings-by-weekday-chart").then(
      (m) => m.BookingsByWeekdayChart,
    ),
  { ssr: false, loading: chartLoading },
);
const RequestsByStatusChart = dynamic(
  () =>
    import("@/components/charts/requests-by-status-chart").then(
      (m) => m.RequestsByStatusChart,
    ),
  { ssr: false, loading: chartLoading },
);

export function AdminAnalytics({
  appointments,
  requests,
}: {
  appointments: Appointment[];
  requests: BookingRequest[];
}) {
  const trend = useMemo(() => bookingsTrend(appointments), [appointments]);
  const weekday = useMemo(() => bookingsByWeekday(appointments), [appointments]);
  const status = useMemo(() => requestsByStatus(requests), [requests]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* text-* drives the charts' currentColor (monochrome line/bars). */}
      <div className="text-stone-900 dark:text-stone-100 xl:col-span-2">
        <ChartCard eyebrow="Trends" title="Bookings over time">
          <BookingsTrendChart data={trend} />
        </ChartCard>
      </div>
      <div className="text-stone-900 dark:text-stone-100">
        <ChartCard eyebrow="Patterns" title="Busiest weekdays">
          <BookingsByWeekdayChart data={weekday} />
        </ChartCard>
      </div>
      <ChartCard eyebrow="Pipeline" title="Requests by status">
        <RequestsByStatusChart data={status} />
      </ChartCard>
    </div>
  );
}
