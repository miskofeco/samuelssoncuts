"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { ChartCard } from "@/components/charts/chart-card";
import type { PerformanceMetric } from "@/components/charts/performance-trend-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Skeleton } from "@/components/shared/skeleton";
import {
  analyticsPeriodStart,
  appointmentsInAnalyticsPeriod,
  bookingsByWeekday,
  bookingsTrend,
  outcomeSummary,
  requestsByStatus,
  requestsInAnalyticsPeriod,
  revenueByService,
  revenueTrend,
  totalRevenueCents,
} from "@/domain/analytics";
import type { Appointment, BookingRequest, Service } from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

type AnalyticsMonths = 3 | 6 | 12;

const chartLoading = () => <Skeleton className="h-full w-full rounded-lg" />;

const PerformanceTrendChart = dynamic(
  () =>
    import("@/components/charts/performance-trend-chart").then(
      (module) => module.PerformanceTrendChart,
    ),
  { ssr: false, loading: chartLoading },
);
const BookingsByWeekdayChart = dynamic(
  () =>
    import("@/components/charts/bookings-by-weekday-chart").then(
      (module) => module.BookingsByWeekdayChart,
    ),
  { ssr: false, loading: chartLoading },
);
const RequestsByStatusChart = dynamic(
  () =>
    import("@/components/charts/requests-by-status-chart").then(
      (module) => module.RequestsByStatusChart,
    ),
  { ssr: false, loading: chartLoading },
);
const RevenueByServiceChart = dynamic(
  () =>
    import("@/components/charts/revenue-by-service-chart").then(
      (module) => module.RevenueByServiceChart,
    ),
  { ssr: false, loading: chartLoading },
);
const OutcomesChart = dynamic(
  () => import("@/components/charts/outcomes-chart").then((module) => module.OutcomesChart),
  { ssr: false, loading: chartLoading },
);

export function AdminAnalytics({
  appointments,
  analyticsAppointments,
  requests,
  services,
  today,
}: {
  appointments: Appointment[];
  analyticsAppointments: Appointment[];
  requests: BookingRequest[];
  services: Service[];
  today: string;
}) {
  const t = useT();
  const lang = useLang();
  const locale = localeFor(lang);
  const [months, setMonths] = useState<AnalyticsMonths>(6);
  const [performanceMetric, setPerformanceMetric] = useState<PerformanceMetric>("bookings");

  const periodAppointments = useMemo(
    () => appointmentsInAnalyticsPeriod(appointments, months, today),
    [appointments, months, today],
  );
  const periodAnalyticsAppointments = useMemo(
    () => appointmentsInAnalyticsPeriod(analyticsAppointments, months, today),
    [analyticsAppointments, months, today],
  );
  const periodRequests = useMemo(
    () => requestsInAnalyticsPeriod(requests, months, today),
    [requests, months, today],
  );
  const bookingTrend = useMemo(
    () => bookingsTrend(periodAppointments, months, locale, today),
    [periodAppointments, months, locale, today],
  );
  const valueTrend = useMemo(
    () => revenueTrend(periodAppointments, requests, services, months, locale, today),
    [periodAppointments, requests, services, months, locale, today],
  );
  const performance = useMemo(
    () =>
      bookingTrend.map((item, index) => ({
        ...item,
        bookingValue: valueTrend[index]?.revenue ?? 0,
      })),
    [bookingTrend, valueTrend],
  );
  const serviceValue = useMemo(
    () => revenueByService(periodAppointments, requests, services),
    [periodAppointments, requests, services],
  );
  const outcomes = useMemo(() => {
    const summary = outcomeSummary(periodAnalyticsAppointments);
    return [
      { label: t.charts.outcomeCompleted, value: summary.completed, key: "completed" },
      { label: t.charts.outcomeNoShow, value: summary.noShow, key: "no_show" },
      { label: t.charts.outcomeCancelled, value: summary.cancelled, key: "cancelled" },
    ];
  }, [
    periodAnalyticsAppointments,
    t.charts.outcomeCompleted,
    t.charts.outcomeNoShow,
    t.charts.outcomeCancelled,
  ]);
  const weekday = useMemo(
    () => bookingsByWeekday(periodAppointments, t.weekdaysShort),
    [periodAppointments, t.weekdaysShort],
  );
  const status = useMemo(
    () =>
      requestsByStatus(periodRequests, {
        new: t.charts.statusNew,
        proposed: t.charts.statusProposed,
        confirmed: t.charts.statusConfirmed,
        closed: t.charts.statusClosed,
      }),
    [
      periodRequests,
      t.charts.statusNew,
      t.charts.statusProposed,
      t.charts.statusConfirmed,
      t.charts.statusClosed,
    ],
  );

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const periodValue = Math.round(totalRevenueCents(periodAppointments, requests, services) / 100);
  const startDate = analyticsPeriodStart(today, months);
  const rangeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }),
    [locale],
  );
  const rangeLabel = `${rangeFormatter.format(new Date(`${startDate}T12:00:00`))} – ${rangeFormatter.format(new Date(`${today}T12:00:00`))}`;
  const hasPerformanceData = periodAppointments.length > 0;

  return (
    <section aria-labelledby="analytics-heading" className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 id="analytics-heading" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t.charts.analyticsTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t.charts.analyticsDescription}
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground tabular-nums" aria-live="polite">
            {rangeLabel}
          </p>
        </div>
        <SegmentedControl
          ariaLabel={t.charts.periodLabel}
          value={String(months) as "3" | "6" | "12"}
          onChange={(value) => setMonths(Number(value) as AnalyticsMonths)}
          options={[
            { value: "3", label: t.charts.period3Months },
            { value: "6", label: t.charts.period6Months },
            { value: "12", label: t.charts.period12Months },
          ]}
          size="sm"
          className="sm:w-auto sm:min-w-72"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.charts.performanceTitle}
          description={t.charts.performanceDescription}
          className="xl:col-span-2"
          contentClassName="h-[22rem] sm:h-[24rem]"
          action={
            <SegmentedControl
              ariaLabel={t.charts.performanceMetricLabel}
              value={performanceMetric}
              onChange={setPerformanceMetric}
              options={[
                { value: "bookings", label: t.charts.bookingsMetric },
                { value: "bookingValue", label: t.charts.bookingValueMetric },
              ]}
              size="sm"
              className="w-full sm:w-auto sm:min-w-72"
            />
          }
        >
          <div className="flex h-full flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4 border-b pb-4">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t.charts.bookingsMetric}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {periodAppointments.length}
                </dd>
              </div>
              <div className="border-s ps-4">
                <dt className="text-xs font-medium text-muted-foreground">{t.charts.bookingValueMetric}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {currency.format(periodValue)}
                </dd>
              </div>
            </dl>
            <div className="min-h-0 flex-1">
              {hasPerformanceData ? (
                <PerformanceTrendChart
                  data={performance}
                  metric={performanceMetric}
                  bookingsLabel={t.charts.bookingsMetric}
                  bookingValueLabel={t.charts.bookingValueMetric}
                  locale={locale}
                />
              ) : (
                <EmptyState
                  title={t.charts.noAnalyticsTitle}
                  description={t.charts.noAnalyticsDescription}
                  className="h-full border-0 bg-transparent py-6"
                />
              )}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title={t.charts.busiestWeekdays}
          description={t.charts.busiestWeekdaysDescription}
        >
          <BookingsByWeekdayChart
            data={weekday}
            bookingsLabel={t.charts.bookingsMetric}
            emptyTitle={t.charts.noAnalyticsTitle}
            emptyDescription={t.charts.noAnalyticsDescription}
          />
        </ChartCard>

        <ChartCard
          title={t.charts.requestsByStatus}
          description={t.charts.requestsByStatusDescription}
        >
          <RequestsByStatusChart
            data={status}
            requestsLabel={t.charts.requestsShort}
            emptyTitle={t.charts.noRequestsYet}
            emptyDescription={t.charts.noRequestsDescription}
          />
        </ChartCard>

        <ChartCard
          title={t.charts.bookingValueByService}
          description={t.charts.bookingValueByServiceDescription}
        >
          <RevenueByServiceChart
            data={serviceValue}
            valueLabel={t.charts.bookingValueMetric}
            emptyTitle={t.charts.noAnalyticsTitle}
            emptyDescription={t.charts.noAnalyticsDescription}
            locale={locale}
          />
        </ChartCard>

        <ChartCard
          title={t.charts.outcomesTitle}
          description={t.charts.outcomesDescription}
        >
          <OutcomesChart
            data={outcomes}
            totalLabel={t.charts.recordedOutcomes}
            noShowRateLabel={t.charts.noShowRate}
            emptyTitle={t.charts.noOutcomesTitle}
            emptyDescription={t.charts.noOutcomesDescription}
          />
        </ChartCard>
      </div>
    </section>
  );
}
