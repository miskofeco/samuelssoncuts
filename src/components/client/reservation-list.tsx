"use client";

import {
  Calendar03Icon,
  CalendarCheckIn01Icon,
  Clock01Icon,
  HourglassIcon,
  InboxIcon,
  Note01Icon,
} from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";

import { cancelRequestAction, respondToProposalAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay, serviceById } from "@/domain/schedule";
import type {
  ActionResult,
  BookingRequest,
  Proposal,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

import { statusMeta } from "./status-meta";

export function ReservationList({
  requests,
  proposals,
  services,
  variant,
}: {
  requests: BookingRequest[];
  proposals: Proposal[];
  services: Service[];
  /** "active" shows actionable cards with controls; "history" is read-only. */
  variant: "active" | "history";
}) {
  const t = useT();
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<Icon icon={InboxIcon} />}
        title={variant === "active" ? t.client.noOpenReservations : t.client.noPastReservations}
        description={
          variant === "active"
            ? t.client.noOpenDescription
            : t.client.noPastDescription
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <ReservationCard
          key={request.id}
          request={request}
          proposal={proposals.find((item) => item.id === request.proposalId)}
          service={serviceById(request.serviceId, services)}
          variant={variant}
        />
      ))}
    </div>
  );
}

function ReservationCard({
  request,
  proposal,
  service,
  variant,
}: {
  request: BookingRequest;
  proposal?: Proposal;
  service: Service;
  variant: "active" | "history";
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const meta = statusMeta(t)[request.status];
  const liveProposal = proposal && proposal.status === "sent" ? proposal : undefined;
  const pendingExactSlot =
    request.status === "pending" && Boolean(request.requestedDate && request.requestedTime);
  const confirmedExactSlot =
    request.status === "confirmed" && Boolean(request.requestedDate && request.requestedTime);

  function respond(accepted: boolean) {
    if (!liveProposal) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        setFeedback(await respondToProposalAction(liveProposal.id, accepted));
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function cancel() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await cancelRequestAction(request.id);
        setFeedback(result);
        if (result.ok) setConfirmingCancel(false);
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <article>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">{service.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
              <Icon icon={Clock01Icon} className="size-3.5" />
              {service.duration} {t.admin.minutesShort} · {service.price} €
            </p>
          </div>
          <StatusPill tone={meta.tone} dot className="shrink-0">
            {meta.label}
          </StatusPill>
        </div>

        {pendingExactSlot ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-amber-500/10 p-3 text-amber-950 ring-1 ring-amber-500/20 dark:text-amber-100">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200">
              <Icon icon={HourglassIcon} className="size-[18px]" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-amber-800 uppercase dark:text-amber-300">
                {t.client.awaitingConfirmation}
              </p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatFullDay(request.requestedDate as string, locale)} ·{" "}
                {request.requestedTime as string}
                {typeof request.priceCents === "number"
                  ? ` · ${Math.round(request.priceCents / 100)} €`
                  : ""}
              </p>
            </div>
          </div>
        ) : request.preferences.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {request.preferences.map((preference) => (
              <span
                key={preference.id}
                className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                <Icon icon={Calendar03Icon} className="size-3.5" />
                {formatFullDay(preference.date, locale)} · {t.windows[preference.window]}
              </span>
            ))}
          </div>
        ) : null}

        {request.note ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <Icon icon={Note01Icon} className="mt-0.5 size-4" />
            <span className="min-w-0">“{request.note}”</span>
          </p>
        ) : null}

        {liveProposal ? (
          <div className="mt-3 rounded-xl bg-sky-500/10 p-3 text-sky-950 ring-1 ring-sky-500/20 sm:p-4 dark:text-sky-100">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-800 dark:text-sky-200">
                <Icon icon={CalendarCheckIn01Icon} className="size-[18px]" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold tabular-nums">
                  {t.client.proposedAt(formatFullDay(liveProposal.date, locale), liveProposal.time)}
                </p>
                {liveProposal.note ? (
                  <p className="mt-1 text-sm text-sky-900/80 dark:text-sky-100/80">
                    {liveProposal.note}
                  </p>
                ) : null}
              </div>
            </div>
            {variant === "active" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={pending}
                  onClick={() => respond(true)}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 sm:h-10 sm:text-sm dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  {pending ? t.common.working : t.client.confirm}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  disabled={pending}
                  onClick={() => respond(false)}
                  className="sm:h-10 sm:text-sm"
                >
                  {t.client.decline}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {request.status === "confirmed" && (proposal || confirmedExactSlot) ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <Icon icon={CalendarCheckIn01Icon} className="size-4" strokeWidth={2} />
            <span className="tabular-nums">
              {t.client.bookedFor(
                formatFullDay(proposal ? proposal.date : request.requestedDate as string, locale),
                proposal ? proposal.time : request.requestedTime as string,
              )}
            </span>
          </p>
        ) : null}

        <Feedback result={feedback} className="mt-3" />

        {variant === "active" &&
        (request.status === "pending" || request.status === "proposed") ? (
          <div className="mt-3 flex sm:justify-end">
            <Button
              type="button"
              variant="dangerOutline"
              disabled={pending}
              onClick={() => setConfirmingCancel(true)}
              className="w-full sm:w-auto"
            >
              {t.client.cancelRequest}
            </Button>
          </div>
        ) : null}

        <ConfirmDialog
          open={confirmingCancel}
          onOpenChange={setConfirmingCancel}
          title={t.client.confirmCancelRequestTitle}
          description={t.client.confirmCancelRequestBody}
          confirmLabel={pending ? t.common.working : t.client.cancelRequest}
          loading={pending}
          onConfirm={cancel}
        >
          <Feedback result={feedback && !feedback.ok ? feedback : null} />
        </ConfirmDialog>
      </article>
    </Card>
  );
}
