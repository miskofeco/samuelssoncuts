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
  Proposal,
  Service,
} from "@/domain/types";

import { requestStatusMeta } from "./status-meta";

export function ClientOverview({
  requests,
  proposals,
  appointments,
  services,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
}) {
  const today = todayIso();
  const upcoming = appointments
    .filter((appointment) => appointment.date >= today)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const next = upcoming[0];
  const awaitingResponse = requests.filter(
    (request) => request.status === "proposed",
  ).length;
  const openRequests = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Open requests" value={openRequests} hint="Waiting for a time" tone={openRequests > 0 ? "sky" : "neutral"} />
        <StatCard label="Needs your reply" value={awaitingResponse} hint="Proposed times" tone={awaitingResponse > 0 ? "amber" : "neutral"} />
        <StatCard label="Upcoming" value={upcoming.length} hint="Confirmed visits" tone={upcoming.length > 0 ? "emerald" : "neutral"} />
        <StatCard label="Total visits" value={appointments.length} hint="All time" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <Card className="rounded-2xl p-5">
          <SectionHeader
            title="Next appointment"
            action={<ButtonLink href="/client/book">Book again</ButtonLink>}
          />
          <div className="mt-4">
            {next ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-lg font-semibold text-emerald-950 dark:text-emerald-200">
                  {serviceById(next.serviceId, services).name}
                </p>
                <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-300">
                  {formatFullDay(next.date)} at {next.time}
                </p>
              </div>
            ) : (
              <EmptyState
                title="No upcoming appointments"
                description="Request a new appointment and your confirmed visit will appear here."
                action={
                  <ButtonLink href="/client/book">Book an appointment</ButtonLink>
                }
              />
            )}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <SectionHeader title="Recent activity" />
          <div className="mt-4 space-y-2">
            {requests.slice(0, 5).length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No requests yet.
              </p>
            ) : (
              requests.slice(0, 5).map((request) => {
                const meta = requestStatusMeta[request.status];
                return (
                  <Link
                    key={request.id}
                    href="/client/reservations"
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2 transition hover:bg-stone-50 dark:border-white/5 dark:hover:bg-stone-800/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-black dark:text-white">
                        {serviceById(request.serviceId, services).name}
                      </span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400">
                        {proposals.find((p) => p.id === request.proposalId)?.date
                          ? `Proposed ${proposals.find((p) => p.id === request.proposalId)?.date}`
                          : "Awaiting proposal"}
                      </span>
                    </span>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
