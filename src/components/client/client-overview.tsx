import Link from "next/link";

import { ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDay, formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  Proposal,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";

import { statusMeta } from "./status-meta";

export async function ClientOverview({
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
  const t = await getDict();
  const locale = localeFor(await getLang());
  const meta = statusMeta(t);
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
        <StatCard label={t.client.openRequests} value={openRequests} hint={t.client.openRequestsHint} tone={openRequests > 0 ? "sky" : "neutral"} />
        <StatCard label={t.client.needsReply} value={awaitingResponse} hint={t.client.needsReplyHint} tone={awaitingResponse > 0 ? "amber" : "neutral"} />
        <StatCard label={t.client.upcoming} value={upcoming.length} hint={t.client.upcomingHint} tone={upcoming.length > 0 ? "emerald" : "neutral"} />
        <StatCard label={t.client.totalVisits} value={appointments.length} hint={t.client.totalVisitsHint} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <Card className="rounded-2xl p-5">
          <SectionHeader
            title={t.client.nextAppointment}
            action={<ButtonLink href="/client/book">{t.client.bookAgain}</ButtonLink>}
          />
          <div className="mt-4">
            {next ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-lg font-semibold text-emerald-950 dark:text-emerald-200">
                  {serviceById(next.serviceId, services).name}
                </p>
                <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-300">
                  {t.client.bookedFor(formatFullDay(next.date, locale), next.time)}
                </p>
              </div>
            ) : (
              <EmptyState
                title={t.client.noUpcoming}
                description={t.client.noUpcomingDescription}
                action={
                  <ButtonLink href="/client/book">{t.client.bookTitle}</ButtonLink>
                }
              />
            )}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <SectionHeader title={t.client.recentActivity} />
          <div className="mt-4 space-y-2">
            {requests.slice(0, 5).length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {t.client.noRequestsYet}
              </p>
            ) : (
              requests.slice(0, 5).map((request) => {
                const status = meta[request.status];
                const proposedDate = proposals.find((p) => p.id === request.proposalId)?.date;
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
                        {proposedDate
                          ? t.client.proposedOn(formatDay(proposedDate, locale))
                          : t.client.awaitingProposal}
                      </span>
                    </span>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
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
