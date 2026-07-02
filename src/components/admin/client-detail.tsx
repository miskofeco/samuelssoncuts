"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  blockClientAction,
  deleteClientAction,
  unblockClientAction,
} from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { totalRevenueCents, outcomeSummary } from "@/domain/analytics";
import { formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import type {
  ApprovalStatus,
  Appointment,
  BookingRequest,
  ClientProfile,
  Proposal,
  Service,
} from "@/domain/types";
import type { ActionResult } from "@/domain/types";
import type { Dict } from "@/i18n/dictionaries";
import { useT } from "@/i18n/provider";

import { statusMeta } from "@/components/client/status-meta";

const statusTone = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  blocked: "danger",
} as const;

function approvalLabel(t: Dict, status: ApprovalStatus) {
  switch (status) {
    case "approved": return t.statuses.approved;
    case "pending":  return t.statuses.approvalPending;
    case "rejected": return t.statuses.rejected;
    case "blocked":  return t.statuses.blocked;
  }
}

export function ClientDetail({
  client,
  requests,
  proposals,
  appointments,
  services,
  locale,
}: {
  client: ClientProfile;
  requests: BookingRequest[];
  proposals: Proposal[];
  appointments: Appointment[];
  services: Service[];
  locale: string;
}) {
  const t = useT();
  const router = useRouter();
  const today = todayIso();
  const upcoming = appointments.filter((a) => a.date >= today).length;
  // Lifetime value excludes no-shows/cancellations (the revenue helper zeroes
  // them) and uses the captured request price where available.
  const totalSpend = Math.round(totalRevenueCents(appointments, requests, services) / 100);
  const noShows = outcomeSummary(appointments).noShow;
  const requestStatusMeta = statusMeta(t);

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [confirmAction, setConfirmAction] = useState<"block" | "delete" | null>(null);

  function run(action: () => Promise<ActionResult>, redirectAfter = false) {
    setFeedback(null);
    setConfirmAction(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok && redirectAfter) router.push("/admin/clients");
    });
  }

  const isBlocked = client.status === "blocked";

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <Card className="rounded-2xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} src={client.avatarUrl} size="lg" />
            <div>
              <h2 className="text-xl font-semibold text-black dark:text-white">{client.name}</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">{client.email}</p>
              {client.phone ? (
                <p className="text-sm text-stone-500 dark:text-stone-400">{client.phone}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={statusTone[client.status]}>{approvalLabel(t, client.status)}</StatusPill>
              <StatusPill tone={client.emailConfirmed ? "success" : "neutral"}>
                {client.emailConfirmed ? t.admin.emailVerified : t.admin.emailUnverified}
              </StatusPill>
            </div>

            {/* Block / Unblock / Delete actions */}
            {confirmAction === null ? (
              <div className="flex flex-wrap gap-2">
                {isBlocked ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => unblockClientAction(client.id))}
                  >
                    {t.admin.unblockClient}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setConfirmAction("block")}
                    className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                  >
                    {t.admin.blockClient}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setConfirmAction("delete")}
                  className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                >
                  {t.admin.deleteClient}
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-black/10 bg-stone-50 p-3 text-sm dark:border-white/10 dark:bg-stone-800/60">
                <p className="text-stone-700 dark:text-stone-300">
                  {confirmAction === "block"
                    ? t.admin.blockClientConfirm
                    : t.admin.deleteClientConfirm}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirmAction === "block") {
                        run(() => blockClientAction(client.id));
                      } else {
                        run(() => deleteClientAction(client.id), true);
                      }
                    }}
                    className={
                      confirmAction === "block"
                        ? "bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-500 dark:text-white dark:hover:bg-amber-400"
                        : "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                    }
                  >
                    {pending
                      ? t.common.working
                      : confirmAction === "block"
                        ? t.admin.blockClient
                        : t.admin.deleteClient}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setConfirmAction(null)}
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Feedback result={feedback} className="mt-4" />
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard label={t.admin.detailTotalVisits} value={appointments.length} />
        <StatCard label={t.admin.detailUpcoming} value={upcoming} tone={upcoming > 0 ? "emerald" : "neutral"} />
        <StatCard label={t.admin.detailRequests} value={requests.length} />
        <StatCard label={t.admin.noShows} value={noShows} hint={t.admin.noShowsHint} tone={noShows > 0 ? "amber" : "neutral"} />
        <StatCard label={t.admin.detailLifetimeValue} value={`${totalSpend} €`} hint={t.admin.detailConfirmedVisits} />
      </div>

      {/* History */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl p-5">
          <SectionHeader title={t.admin.detailAppointments} />
          <div className="mt-4 space-y-2">
            {appointments.length === 0 ? (
              <EmptyState title={t.admin.noAppointmentsYet} />
            ) : (
              [...appointments]
                .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-black/5 px-3 py-2.5 dark:border-white/5"
                  >
                    <p className="text-sm font-semibold text-black dark:text-white">
                      {serviceById(appointment.serviceId, services).name}
                    </p>
                    <p className="text-sm tabular-nums text-stone-500 dark:text-stone-400">
                      {formatFullDay(appointment.date, locale)} · {appointment.time}
                    </p>
                  </div>
                ))
            )}
          </div>
        </Card>

        <Card className="rounded-2xl p-5">
          <SectionHeader title={t.admin.detailRequestHistory} />
          <div className="mt-4 space-y-2">
            {requests.length === 0 ? (
              <EmptyState title={t.client.noRequestsYet} />
            ) : (
              [...requests]
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .map((request) => {
                  const meta = requestStatusMeta[request.status];
                  const proposal = proposals.find((p) => p.id === request.proposalId);
                  return (
                    <div
                      key={request.id}
                      className="rounded-lg border border-black/5 px-3 py-2.5 dark:border-white/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-black dark:text-white">
                          {serviceById(request.serviceId, services).name}
                        </p>
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </div>
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {proposal
                          ? t.client.proposedAt(formatFullDay(proposal.date, locale), proposal.time)
                          : request.preferences
                              .map((preference) => formatFullDay(preference.date, locale))
                              .join(", ")}
                      </p>
                    </div>
                  );
                })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
