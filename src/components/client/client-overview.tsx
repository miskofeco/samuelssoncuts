import {
  Alert02Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  CheckmarkCircle02Icon,
  HourglassIcon,
  InboxIcon,
  Notification03Icon,
  Scissor01Icon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";

import { ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon, type IconSource } from "@/components/shared/icon";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatDay, formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  Proposal,
  RequestStatus,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { cn } from "@/lib/classnames";

import { statusMeta } from "./status-meta";

const statusIcons: Record<RequestStatus, IconSource> = {
  pending: HourglassIcon,
  proposed: Notification03Icon,
  confirmed: CheckmarkCircle02Icon,
  declined: UnavailableIcon,
};

const statusIconTones: Record<RequestStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  proposed: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  confirmed: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  declined: "bg-destructive/10 text-destructive",
};

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

  // One-tap rebooking: prefill the book form with the client's most recent
  // service (next upcoming, else latest past appointment).
  const lastServiceId =
    next?.serviceId ??
    [...appointments].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))[0]?.serviceId;
  const bookAgainHref = lastServiceId
    ? `/client/book?service=${lastServiceId}`
    : "/client/book";

  const recent = requests.slice(0, 5);

  return (
    <div className="space-y-6">
      {plannedBlocked.length > 0 ? (
        <section
          role="status"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950 sm:p-5 dark:text-amber-100"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-200">
                <Icon icon={Alert02Icon} className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-amber-800 uppercase dark:text-amber-300">
                  {t.client.blockedNoticeEyebrow}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
                  {t.client.blockedNoticeTitle}
                </h2>
                <p className="mt-1 text-sm text-amber-900/85 dark:text-amber-100/80">
                  {t.client.blockedNoticeDescription}
                </p>
              </div>
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
                  className="flex items-start gap-2 rounded-xl bg-background/70 px-3 py-2 text-sm font-semibold text-amber-950 ring-1 ring-amber-500/20 dark:bg-black/20 dark:text-amber-100"
                >
                  <Icon icon={Calendar03Icon} className="mt-0.5 size-4 text-amber-700 dark:text-amber-300" />
                  <span className="min-w-0">
                    {label}
                    {range.reason ? (
                      <span className="mt-0.5 block text-xs font-medium text-amber-900/70 dark:text-amber-100/70">
                        {range.reason}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label={t.client.openRequests}
          value={openRequests}
          hint={t.client.openRequestsHint}
          tone={openRequests > 0 ? "sky" : "neutral"}
          icon={InboxIcon}
        />
        <StatCard
          label={t.client.needsReply}
          value={awaitingResponse}
          hint={t.client.needsReplyHint}
          tone={awaitingResponse > 0 ? "amber" : "neutral"}
          icon={Notification03Icon}
        />
        <StatCard
          label={t.client.upcoming}
          value={upcoming.length}
          hint={t.client.upcomingHint}
          tone={upcoming.length > 0 ? "emerald" : "neutral"}
          icon={Calendar03Icon}
        />
        <StatCard
          label={t.client.totalVisits}
          value={appointments.length}
          hint={t.client.totalVisitsHint}
          icon={Scissor01Icon}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        {/* Next appointment hero */}
        {next ? (
          <section className="relative overflow-hidden rounded-2xl bg-emerald-600 p-5 text-white shadow-xs sm:p-6 dark:bg-emerald-700">
            <Icon
              icon={CalendarCheckIn01Icon}
              className="pointer-events-none absolute -right-6 -bottom-8 size-44 text-white/10"
              strokeWidth={1.2}
            />
            <div className="relative">
              <p className="flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.12em] text-white/80 uppercase">
                <Icon icon={CalendarCheckIn01Icon} className="size-4" strokeWidth={2} />
                {t.client.nextAppointment}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {serviceById(next.serviceId, services).name}
              </h2>
              <p className="mt-1.5 text-base text-white/90 tabular-nums">
                {t.client.bookedFor(formatFullDay(next.date, locale), next.time)}
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <ButtonLink
                  href={`/client/reservations/${next.id}`}
                  size="lg"
                  className="bg-white text-emerald-900 hover:bg-white/90 sm:h-10 sm:text-sm"
                >
                  {t.client.detailTitle}
                  <Icon icon={ArrowRight01Icon} className="size-4" strokeWidth={2} />
                </ButtonLink>
                <ButtonLink
                  href={bookAgainHref}
                  size="lg"
                  className="border border-white/30 bg-white/10 text-white hover:bg-white/20 sm:h-10 sm:text-sm"
                >
                  {t.client.bookAgain}
                </ButtonLink>
              </div>
            </div>
          </section>
        ) : (
          <Card className="rounded-2xl">
            <SectionHeader
              title={t.client.nextAppointment}
              action={<ButtonLink href={bookAgainHref}>{t.client.bookAgain}</ButtonLink>}
            />
            <EmptyState
              className="mt-4"
              icon={<Icon icon={Calendar03Icon} />}
              title={t.client.noUpcoming}
              description={t.client.noUpcomingDescription}
              action={<ButtonLink href="/client/book" size="lg">{t.client.bookTitle}</ButtonLink>}
            />
          </Card>
        )}

        {/* Recent activity */}
        <Card className="rounded-2xl">
          <SectionHeader title={t.client.recentActivity} />
          <div className="mt-3">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.client.noRequestsYet}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recent.map((request) => {
                  const status = meta[request.status];
                  const proposedDate = proposals.find((p) => p.id === request.proposalId)?.date;
                  return (
                    <li key={request.id}>
                      <Link
                        href="/client/reservations"
                        className="group/item flex min-h-14 w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
                      >
                        <ItemMedia
                          variant="icon"
                          className={cn("size-9 rounded-lg", statusIconTones[request.status])}
                        >
                          <Icon icon={statusIcons[request.status]} className="size-[18px]" />
                        </ItemMedia>
                        <ItemContent className="gap-0.5">
                          <ItemTitle className="font-semibold">
                            {serviceById(request.serviceId, services).name}
                          </ItemTitle>
                          <ItemDescription className="text-xs">
                            {proposedDate
                              ? t.client.proposedOn(formatDay(proposedDate, locale))
                              : t.client.awaitingProposal}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions className="gap-1">
                          <StatusPill tone={status.tone} dot>
                            {status.label}
                          </StatusPill>
                          <Icon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
                        </ItemActions>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
