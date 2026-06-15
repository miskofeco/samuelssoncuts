import Link from "next/link";

import { ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Service,
} from "@/domain/types";

export function AdminOverview({
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
  const today = todayIso();
  const pendingApprovals = clients.filter(
    (c) => c.role !== "admin" && c.status === "pending" && c.emailConfirmed,
  ).length;
  const openRequests = requests.filter((r) => r.status === "pending").length;
  const awaitingClient = requests.filter((r) => r.status === "proposed").length;
  const upcoming = appointments
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Pending approvals" value={pendingApprovals} hint="Verified, awaiting review" tone={pendingApprovals > 0 ? "amber" : "neutral"} />
        <StatCard label="Open requests" value={openRequests} hint="Need a proposed time" tone={openRequests > 0 ? "sky" : "neutral"} />
        <StatCard label="Awaiting client" value={awaitingClient} hint="Proposal sent" />
        <StatCard label="Confirmed" value={appointments.length} hint="All bookings" tone={appointments.length > 0 ? "emerald" : "neutral"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <Card className="rounded-2xl p-5">
          <SectionHeader
            title="Upcoming appointments"
            action={<ButtonLink href="/admin/calendar" variant="secondary">View calendar</ButtonLink>}
          />
          <div className="mt-4 space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState title="No upcoming appointments" />
            ) : (
              upcoming.slice(0, 6).map((appointment) => {
                const client = clients.find((c) => c.id === appointment.clientId);
                return (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2.5 dark:border-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-black dark:text-white">
                        {client?.name ?? "Client"}
                      </p>
                      <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                        {serviceById(appointment.serviceId, services).name}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums text-stone-600 dark:text-stone-300">
                      {formatFullDay(appointment.date)} · {appointment.time}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <SectionHeader title="Needs attention" />
          <div className="mt-4 space-y-2">
            <AttentionRow
              href="/admin/approvals"
              label="Pending approvals"
              count={pendingApprovals}
              tone="warning"
            />
            <AttentionRow
              href="/admin/requests"
              label="New requests"
              count={openRequests}
              tone="info"
            />
            <AttentionRow
              href="/admin/requests"
              label="Awaiting client reply"
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
