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
  blockedRanges,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
  blockedRanges: Array<{ id: string; start: string; end: string; reason: string | null }>;
}) {
  const t = await getDict();
  const locale = localeFor(await getLang());
  const meta = statusMeta(t);
  const today = todayIso();
  const plannedBlocked = blockedRanges
    .filter((range) => range.end >= today)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
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
      {plannedBlocked.length > 0 ? (
        <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950 shadow-sm dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                {t.client.blockedNoticeEyebrow}
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {t.client.blockedNoticeTitle}
              </h2>
              <p className="mt-1 text-sm text-orange-900/80 dark:text-orange-100/80">
                {t.client.blockedNoticeDescription}
              </p>
            </div>
            <ButtonLink
              href="/client/book"
              variant="secondary"
              className="w-full shrink-0 sm:w-auto"
            >
              {t.client.bookTitle}
            </ButtonLink>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {plannedBlocked.map((range) => {
              const label =
                range.start === range.end
                  ? formatFullDay(range.start, locale)
                  : `${formatFullDay(range.start, locale)} - ${formatFullDay(range.end, locale)}`;

              return (
                <li
                  key={range.id}
                  className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-orange-950 dark:bg-black/15 dark:text-orange-100"
                >
                  {label}
                  {range.reason ? (
                    <span className="mt-0.5 block text-xs font-medium text-orange-900/70 dark:text-orange-100/70">
                      {range.reason}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
