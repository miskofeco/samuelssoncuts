"use client";

import { useState, useTransition } from "react";

import { cancelRequestAction, respondToProposalAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
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
  const meta = statusMeta(t)[request.status];
  const liveProposal = proposal && proposal.status === "sent" ? proposal : undefined;

  function respond(accepted: boolean) {
    if (!liveProposal) return;
    setFeedback(null);
    startTransition(async () => {
      setFeedback(await respondToProposalAction(liveProposal.id, accepted));
    });
  }

  function cancel() {
    setFeedback(null);
    startTransition(async () => {
      setFeedback(await cancelRequestAction(request.id));
    });
  }

  return (
    <article className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-stone-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-black dark:text-white">{service.name}</h3>
          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
            {service.duration} min · ${service.price}
          </p>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {request.preferences.map((preference) => (
          <span
            key={preference.id}
            className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300"
          >
            {formatFullDay(preference.date, locale)} · {t.windows[preference.window]}
          </span>
        ))}
      </div>

      {request.note ? (
        <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-300">
          “{request.note}”
        </p>
      ) : null}

      {liveProposal ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-950 dark:text-emerald-200">
            {t.client.proposedAt(formatFullDay(liveProposal.date, locale), liveProposal.time)}
          </p>
          {liveProposal.note ? (
            <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-300">
              {liveProposal.note}
            </p>
          ) : null}
          {variant === "active" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" disabled={pending} onClick={() => respond(true)}>
                {pending ? t.common.working : t.client.confirm}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => respond(false)}
              >
                {t.client.decline}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {request.status === "confirmed" && proposal ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300">
          {t.client.bookedFor(formatFullDay(proposal.date, locale), proposal.time)}
        </p>
      ) : null}

      <Feedback result={feedback} className="mt-3" />

      {variant === "active" &&
      (request.status === "pending" || request.status === "proposed") ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={cancel}
            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            {t.client.cancelRequest}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
