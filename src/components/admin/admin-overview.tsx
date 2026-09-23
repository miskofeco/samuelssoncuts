import {
  ArrowRight01Icon,
  Calendar03Icon,
  ChartLineData01Icon,
  HourglassIcon,
  InboxIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import Link from "next/link";

import { ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Icon } from "@/components/shared/icon";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { isReadyForApproval } from "@/domain/approval";
import {
  formatFullDay,
  serviceById,
  surchargeDetailsForRequest,
  todayIso,
} from "@/domain/schedule";
import {
  adminOverviewMetricTrends,
  revenueLookups,
  totalRevenueCents,
} from "@/domain/analytics";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  PricingSettings,
  Service,
} from "@/domain/types";
import { cn } from "@/lib/classnames";
import { AdminUpcomingAppointments } from "./admin-upcoming-appointments";
import type { AdminUpcomingAppointmentItem } from "./admin-upcoming-appointments";
import type { BookedSlotInput } from "./admin-booking-carousel";

export async function AdminOverview({
  clients,
  requests,
  appointments,
  services,
  pricingSettings,
}: {
  clients: ClientProfile[];
  requests: BookingRequest[];
  appointments: Appointment[];
  services: Service[];
  pricingSettings: PricingSettings;
}) {
  const t = await getDict();
  const locale = localeFor(await getLang());
  const today = todayIso();
  const pendingApprovals = clients.filter(
    (c) => c.role !== "admin" && c.status === "pending" && isReadyForApproval(c),
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
    const surcharge = request ? surchargeDetailsForRequest(request, pricingSettings) : null;
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
        surchargeKind: surcharge?.kind,
        surchargePercent: surcharge?.percent,
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
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.admin.todayAppointments}
          value={todays.length}
          hint={t.admin.todayAppointmentsHint}
          tone={todays.length > 0 ? "emerald" : "neutral"}
          icon={Calendar03Icon}
          trend={trends.todayAppointments}
        />
        <StatCard
          label={t.admin.revenueThisMonth}
          value={`${monthRevenue} €`}
          hint={t.admin.revenueThisMonthHint}
          icon={ChartLineData01Icon}
          trend={trends.revenueThisMonth}
        />
        <StatCard
          label={t.admin.openRequests}
          value={openRequests}
          hint={t.admin.openRequestsHint}
          tone={openRequests > 0 ? "sky" : "neutral"}
          icon={InboxIcon}
          trend={trends.openRequests}
        />
        <StatCard
          label={t.admin.awaitingClient}
          value={awaitingClient}
          hint={t.admin.awaitingClientHint}
          tone={awaitingClient > 0 ? "amber" : "neutral"}
          icon={HourglassIcon}
          trend={trends.awaitingClient}
        />
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <Card>
          <SectionHeader
            title={t.admin.upcomingAppointments}
            action={
              <ButtonLink href="/admin/calendar" variant="outline" size="sm">
                {t.admin.viewCalendar}
                <Icon icon={ArrowRight01Icon} />
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

        <Card>
          <SectionHeader title={t.admin.needsAttention} />
          <ul className="mt-4 divide-y">
            <AttentionRow
              href="/admin/approvals"
              icon={UserCheck01Icon}
              label={t.admin.pendingApprovals}
              count={pendingApprovals}
              tone="warning"
            />
            <AttentionRow
              href="/admin/requests"
              icon={InboxIcon}
              label={t.admin.newRequests}
              count={openRequests}
              tone="info"
            />
            <AttentionRow
              href="/admin/requests?filter=proposed"
              icon={HourglassIcon}
              label={t.admin.awaitingClientReply}
              count={awaitingClient}
              tone="neutral"
            />
          </ul>
        </Card>
      </div>
    </div>
  );
}

const attentionIconTone = {
  warning: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  info: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  neutral: "bg-muted text-muted-foreground",
} as const;

/** Tappable row linking to the queue that needs work; the count is a StatusPill. */
function AttentionRow({
  href,
  icon,
  label,
  count,
  tone,
}: {
  href: string;
  icon: IconSvgElement;
  label: string;
  count: number;
  tone: keyof typeof attentionIconTone;
}) {
  const active = count > 0;
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            active ? attentionIconTone[tone] : attentionIconTone.neutral,
          )}
        >
          <Icon icon={icon} className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</span>
        <StatusPill tone={active ? tone : "neutral"} dot={active} className="tabular-nums">
          {count}
        </StatusPill>
        <Icon icon={ArrowRight01Icon} className="text-muted-foreground" />
      </Link>
    </li>
  );
}
