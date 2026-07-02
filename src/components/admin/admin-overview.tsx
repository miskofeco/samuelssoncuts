import Link from "next/link";

import { Avatar } from "@/components/shared/avatar";
import { ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import {
  appointmentRevenueCents,
  revenueLookups,
  totalRevenueCents,
} from "@/domain/analytics";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Service,
} from "@/domain/types";

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

  // Today at a glance + revenue (features 1 & 13). Money derives from the
  // request price (or service list price), never stored on the appointment.
  const todays = appointments.filter((a) => a.date === today);
  const { requestsById, servicesById } = revenueLookups(requests, services);
  const todayRevenue = Math.round(
    todays.reduce((sum, a) => sum + appointmentRevenueCents(a, requestsById, servicesById), 0) /
      100,
  );
  const monthPrefix = today.slice(0, 7);
  const monthRevenue = Math.round(
    totalRevenueCents(
      appointments.filter((a) => a.date.slice(0, 7) === monthPrefix),
      requests,
      services,
    ) / 100,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label={t.admin.todayAppointments} value={todays.length} hint={t.admin.todayAppointmentsHint} tone={todays.length > 0 ? "emerald" : "neutral"} />
        <StatCard label={t.admin.todayRevenue} value={`${todayRevenue} €`} hint={t.admin.todayRevenueHint} tone={todayRevenue > 0 ? "emerald" : "neutral"} />
        <StatCard label={t.admin.revenueThisMonth} value={`${monthRevenue} €`} hint={t.admin.revenueThisMonthHint} />
        <StatCard label={t.admin.pendingApprovals} value={pendingApprovals} hint={t.admin.pendingApprovalsHint} tone={pendingApprovals > 0 ? "amber" : "neutral"} />
        <StatCard label={t.admin.openRequests} value={openRequests} hint={t.admin.openRequestsHint} tone={openRequests > 0 ? "sky" : "neutral"} />
        <StatCard label={t.admin.awaitingClient} value={awaitingClient} hint={t.admin.awaitingClientHint} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <Card className="rounded-2xl p-5">
          <SectionHeader
            title={t.admin.upcomingAppointments}
            action={<ButtonLink href="/admin/calendar" variant="secondary">{t.admin.viewCalendar}</ButtonLink>}
          />
          <div className="mt-4 space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState title={t.admin.noUpcoming} />
            ) : (
              upcoming.slice(0, 6).map((appointment) => {
                const client = clients.find((c) => c.id === appointment.clientId);
                return (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2.5 dark:border-white/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        size="sm"
                        name={client?.name ?? appointment.clientName ?? t.admin.clientFallback}
                        src={client?.avatarUrl}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-black dark:text-white">
                          {client?.name ?? appointment.clientName ?? t.admin.clientFallback}
                        </p>
                        <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                          {serviceById(appointment.serviceId, services).name}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums text-stone-600 dark:text-stone-300">
                      {formatFullDay(appointment.date, locale)} · {appointment.time}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <SectionHeader title={t.admin.needsAttention} />
          <div className="mt-4 space-y-2">
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
      className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2.5 transition hover:bg-stone-50 dark:border-white/5 dark:hover:bg-stone-800/50"
    >
      <span className="text-sm font-medium text-black dark:text-white">{label}</span>
      <StatusPill tone={count > 0 ? tone : "neutral"}>{count}</StatusPill>
    </Link>
  );
}
