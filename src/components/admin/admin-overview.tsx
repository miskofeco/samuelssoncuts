import Link from "next/link";

import { ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import {
  adminOverviewMetricTrends,
  revenueLookups,
  totalRevenueCents,
} from "@/domain/analytics";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Service,
} from "@/domain/types";
import { AdminUpcomingAppointments } from "./admin-upcoming-appointments";
import type { AdminUpcomingAppointmentItem } from "./admin-upcoming-appointments";
import type { BookedSlotInput } from "./admin-booking-carousel";

export async function AdminOverview({
  clients,
  requests,
  appointments,
  services,
}: {
  clients: ClientProfile[];
  requests: BookingRequest[];
  appointments: Appointment[];
  services: Service[];
}) {
  const t = await getDict();
  const locale = localeFor(await getLang());
  const today = todayIso();
  const pendingApprovals = clients.filter(
    (c) => c.role !== "admin" && c.status === "pending" && c.emailConfirmed,
  ).length;
  const openRequests = requests.filter((r) => r.status === "pending").length;
  const awaitingClient = requests.filter((r) => r.status === "proposed").length;
  const upcoming = appointments
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const todays = appointments.filter((a) => a.date === today);
  const { requestsById } = revenueLookups(requests, services);
  const monthPrefix = today.slice(0, 7);
  const monthRevenue = Math.round(
    totalRevenueCents(
      appointments.filter((a) => a.date.slice(0, 7) === monthPrefix),
      requests,
      services,
    ) / 100,
  );
  const trends = adminOverviewMetricTrends({
    appointments,
    requests,
    services,
    clients,
    today,
  });
  const bookedSlots: BookedSlotInput[] = appointments.map((appointment) => ({
    id: appointment.id,
    date: appointment.date,
    time: appointment.time,
    durationMinutes: serviceById(appointment.serviceId, services).duration,
  }));
  const upcomingItems: AdminUpcomingAppointmentItem[] = upcoming.slice(0, 6).map((appointment) => {
    const client = clients.find((c) => c.id === appointment.clientId);
    const service = serviceById(appointment.serviceId, services);
    const request = appointment.requestId ? requestsById.get(appointment.requestId) : undefined;
    const servicePriceCents = Math.round(service.price * 100);
    const bookedPriceCents = appointment.requestId
      ? request?.priceCents ?? servicePriceCents
      : servicePriceCents;
    const clientName = client?.name ?? appointment.clientName ?? t.admin.clientFallback;

    return {
      id: appointment.id,
      clientName,
      clientAvatarUrl: client?.avatarUrl,
      serviceName: service.name,
      when: `${formatFullDay(appointment.date, locale)} · ${appointment.time}`,
      calendarItem: {
        id: appointment.id,
        title: clientName,
        service: service.name,
        servicePrice: service.price,
        finalPriceCents: bookedPriceCents,
        surcharge: request?.surcharge,
        time: appointment.time,
        date: appointment.date,
        durationMinutes: service.duration,
        type: appointment.requestId ? "Confirmed" : "Barber",
        appointmentId: appointment.id,
        requestId: appointment.requestId,
        clientId: appointment.clientId,
        clientEmail: client?.email,
        clientPhone: client?.phone,
        clientAvatarUrl: client?.avatarUrl,
        outcome: appointment.outcome,
      },
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.admin.todayAppointments}
          value={todays.length}
          hint={t.admin.todayAppointmentsHint}
          tone={todays.length > 0 ? "emerald" : "neutral"}
          icon={<CalendarIcon />}
          trend={trends.todayAppointments}
          variant="overview"
        />
        <StatCard
          label={t.admin.revenueThisMonth}
          value={`${monthRevenue} €`}
          hint={t.admin.revenueThisMonthHint}
          icon={<ChartIcon />}
          trend={trends.revenueThisMonth}
          variant="overview"
        />
        <StatCard
          label={t.admin.openRequests}
          value={openRequests}
          hint={t.admin.openRequestsHint}
          tone={openRequests > 0 ? "sky" : "neutral"}
          icon={<InboxIcon />}
          trend={trends.openRequests}
          variant="overview"
        />
        <StatCard
          label={t.admin.awaitingClient}
          value={awaitingClient}
          hint={t.admin.awaitingClientHint}
          icon={<ClockIcon />}
          trend={trends.awaitingClient}
          variant="overview"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <Card className="rounded-lg border-black/10 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.035)] dark:border-white/10 dark:bg-stone-900">
          <SectionHeader
            title={t.admin.upcomingAppointments}
            action={
              <ButtonLink
                href="/admin/calendar"
                variant="secondary"
                className="min-h-9 rounded-md border-0 bg-stone-100 px-4 font-medium text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                {t.admin.viewCalendar}
              </ButtonLink>
            }
          />
          <AdminUpcomingAppointments
            items={upcomingItems}
            bookedSlots={bookedSlots}
            emptyTitle={t.admin.noUpcoming}
            labels={{
              name: t.common.fullName,
              service: t.client.service,
              date: t.admin.date,
            }}
          />
        </Card>

        <Card className="rounded-lg border-black/10 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.035)] dark:border-white/10 dark:bg-stone-900">
          <SectionHeader title={t.admin.needsAttention} />
          <div className="mt-5 divide-y divide-black/5 border-y border-black/5 dark:divide-white/5 dark:border-white/5">
            <AttentionRow
              href="/admin/approvals"
              label={t.admin.pendingApprovals}
              count={pendingApprovals}
              tone="warning"
            />
            <AttentionRow
              href="/admin/requests"
              label={t.admin.newRequests}
              count={openRequests}
              tone="info"
            />
            <AttentionRow
              href="/admin/requests"
              label={t.admin.awaitingClientReply}
              count={awaitingClient}
              tone="neutral"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 20V10M12 20V4M19 20v-7M3 20h18" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5h16v14H4V5ZM4 14h4l2 3h4l2-3h4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function AttentionRow({
  href,
  label,
  count,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  tone: "warning" | "info" | "neutral";
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 px-1 py-4 transition hover:bg-stone-50 dark:hover:bg-stone-800/50"
    >
      <span className="text-sm font-medium text-stone-600 dark:text-stone-300">{label}</span>
      <StatusPill tone={count > 0 ? tone : "neutral"} className="rounded-md px-3">
        {count}
      </StatusPill>
    </Link>
  );
}
