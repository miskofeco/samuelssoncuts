"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { ChartCard } from "@/components/charts/chart-card";
import {
  bookingsByWeekday,
  bookingsTrend,
  outcomeSummary,
  requestsByStatus,
  revenueByService,
  revenueTrend,
} from "@/domain/analytics";
import type { Appointment, BookingRequest, Service } from "@/domain/types";
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
const RevenueTrendChart = dynamic(
  () => import("@/components/charts/revenue-trend-chart").then((m) => m.RevenueTrendChart),
  { ssr: false, loading: chartLoading },
);
const RevenueByServiceChart = dynamic(
  () =>
    import("@/components/charts/revenue-by-service-chart").then(
      (m) => m.RevenueByServiceChart,
    ),
  { ssr: false, loading: chartLoading },
);
const OutcomesChart = dynamic(
  () => import("@/components/charts/outcomes-chart").then((m) => m.OutcomesChart),
  { ssr: false, loading: chartLoading },
);

export function AdminAnalytics({
  appointments,
  requests,
  services,
}: {
  appointments: Appointment[];
  requests: BookingRequest[];
  services: Service[];
}) {
  const t = useT();
  const lang = useLang();
  const locale = localeFor(lang);
  const trend = useMemo(
    () => bookingsTrend(appointments, 6, locale),
    [appointments, locale],
  );
  const revTrend = useMemo(
    () => revenueTrend(appointments, requests, services, 6, locale),
    [appointments, requests, services, locale],
  );
  const revByService = useMemo(
    () => revenueByService(appointments, requests, services),
    [appointments, requests, services],
  );
  const outcomes = useMemo(() => {
    const s = outcomeSummary(appointments);
    return [
      { label: t.charts.outcomeCompleted, value: s.completed, key: "completed" },
      { label: t.charts.outcomeNoShow, value: s.noShow, key: "no_show" },
      { label: t.charts.outcomeCancelled, value: s.cancelled, key: "cancelled" },
    ];
  }, [appointments, t.charts.outcomeCompleted, t.charts.outcomeNoShow, t.charts.outcomeCancelled]);
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
      <div className="text-stone-900 dark:text-stone-100 xl:col-span-2">
        <ChartCard eyebrow={t.charts.revenueEyebrow} title={t.charts.revenueOverTime}>
          <RevenueTrendChart data={revTrend} />
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
      <div className="text-stone-900 dark:text-stone-100">
        <ChartCard eyebrow={t.charts.revenueEyebrow} title={t.charts.revenueByService}>
          <RevenueByServiceChart data={revByService} emptyLabel={t.charts.noRequestsYet} />
        </ChartCard>
      </div>
      <ChartCard eyebrow={t.charts.outcomesEyebrow} title={t.charts.outcomesTitle}>
        <OutcomesChart data={outcomes} emptyLabel={t.charts.noRequestsYet} />
      </ChartCard>
    </div>
  );
}
