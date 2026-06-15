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
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

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
  const t = useT();
  const lang = useLang();
  const locale = localeFor(lang);
  const trend = useMemo(
    () => bookingsTrend(appointments, 6, locale),
    [appointments, locale],
  );
  const weekday = useMemo(
    () => bookingsByWeekday(appointments, t.weekdaysShort),
    [appointments, t.weekdaysShort],
  );
  const status = useMemo(
    () =>
      requestsByStatus(requests, {
        new: t.charts.statusNew,
        proposed: t.charts.statusProposed,
        confirmed: t.charts.statusConfirmed,
        closed: t.charts.statusClosed,
      }),
    [
      requests,
      t.charts.statusNew,
      t.charts.statusProposed,
      t.charts.statusConfirmed,
      t.charts.statusClosed,
    ],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* text-* drives the charts' currentColor (monochrome line/bars). */}
      <div className="text-stone-900 dark:text-stone-100 xl:col-span-2">
        <ChartCard eyebrow={t.charts.trendsEyebrow} title={t.charts.bookingsOverTime}>
          <BookingsTrendChart data={trend} />
        </ChartCard>
      </div>
      <div className="text-stone-900 dark:text-stone-100">
        <ChartCard eyebrow={t.charts.patternsEyebrow} title={t.charts.busiestWeekdays}>
          <BookingsByWeekdayChart data={weekday} />
        </ChartCard>
      </div>
      <ChartCard eyebrow={t.charts.pipelineEyebrow} title={t.charts.requestsByStatus}>
        <RequestsByStatusChart data={status} />
      </ChartCard>
    </div>
  );
}
