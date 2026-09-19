"use client";

import {
  Calendar03Icon,
  CalendarCheckIn01Icon,
  Call02Icon,
  Delete02Icon,
  InboxIcon,
  Mail01Icon,
  MoneyBag02Icon,
  Scissor01Icon,
  UnavailableIcon,
  UserBlock01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  blockClientAction,
  deleteClientAction,
  unblockClientAction,
} from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button, buttonClass } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/status-pill";
import { totalRevenueCents, outcomeSummary } from "@/domain/analytics";
import { formatFullDay, serviceById, todayIso } from "@/domain/schedule";
import type {
  Appointment,
  AppointmentOutcome,
  BookingRequest,
  ClientProfile,
  Proposal,
  Service,
} from "@/domain/types";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

import { statusMeta } from "@/components/client/status-meta";
import { clientStatusLabel, clientStatusTone } from "./client-status";

const outcomeTone: Record<AppointmentOutcome, "success" | "danger" | "neutral"> = {
  completed: "success",
  no_show: "danger",
  cancelled: "neutral",
};

/**
 * Client profile: header card (avatar, contact actions, moderation), KPI
 * tiles, then appointment and request history. Block/delete confirm through
 * the shared ConfirmDialog.
 */
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
      try {
        const result = await action();
        setFeedback(result);
        if (result.ok && redirectAfter) router.push("/admin/clients");
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  const isBlocked = client.status === "blocked";
  const outcomeLabel: Record<AppointmentOutcome, string> = {
    completed: t.admin.outcomeCompleted,
    no_show: t.admin.outcomeNoShow,
    cancelled: t.statuses.cancelled,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Profile header */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={client.name} src={client.avatarUrl} size="xl" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {client.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <StatusPill tone={clientStatusTone[client.status]} dot>
                  {clientStatusLabel(t, client.status)}
                </StatusPill>
                <StatusPill tone={client.emailConfirmed ? "success" : "neutral"}>
                  {client.emailConfirmed ? t.admin.emailVerified : t.admin.emailUnverified}
                </StatusPill>
              </div>
              {/* Contact actions: tap to mail / call. */}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`mailto:${client.email}`}
                  className={cn(buttonClass("outline", "max-w-full", "sm"))}
                >
                  <Icon icon={Mail01Icon} />
                  <span className="truncate">{client.email}</span>
                </a>
                {client.phone ? (
                  <a href={`tel:${client.phone}`} className={cn(buttonClass("outline", "tabular-nums", "sm"))}>
                    <Icon icon={Call02Icon} />
                    {client.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* Block / Unblock / Delete actions */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:justify-end">
            {isBlocked ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                loading={pending}
                onClick={() => run(() => unblockClientAction(client.id))}
                className="sm:w-auto"
              >
                <Icon icon={UserCheck01Icon} />
                {t.admin.unblockClient}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={pending}
                onClick={() => setConfirmAction("block")}
                className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 sm:w-auto"
              >
                <Icon icon={UserBlock01Icon} />
                {t.admin.blockClient}
              </Button>
            )}
            <Button
              type="button"
              variant="dangerOutline"
              size="lg"
              disabled={pending}
              onClick={() => setConfirmAction("delete")}
              className="sm:w-auto"
            >
              <Icon icon={Delete02Icon} />
              {t.admin.deleteClient}
            </Button>
          </div>
        </div>

        <Feedback result={feedback} className="mt-4" />
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t.admin.detailTotalVisits} value={appointments.length} icon={Calendar03Icon} />
        <StatCard
          label={t.admin.detailUpcoming}
          value={upcoming}
          tone={upcoming > 0 ? "emerald" : "neutral"}
          icon={CalendarCheckIn01Icon}
        />
        <StatCard label={t.admin.detailRequests} value={requests.length} icon={InboxIcon} />
        <StatCard
          label={t.admin.noShows}
          value={noShows}
          hint={t.admin.noShowsHint}
          tone={noShows > 0 ? "amber" : "neutral"}
          icon={UnavailableIcon}
        />
        <StatCard
          label={t.admin.detailLifetimeValue}
          value={`${totalSpend} €`}
          hint={t.admin.detailConfirmedVisits}
          icon={MoneyBag02Icon}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* History */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeader title={t.admin.detailAppointments} />
          <div className="mt-4">
            {appointments.length === 0 ? (
              <EmptyState title={t.admin.noAppointmentsYet} icon={<Icon icon={Calendar03Icon} />} />
            ) : (
              <ul className="divide-y">
                {[...appointments]
                  .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
                  .map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex min-h-14 items-center gap-3 py-2.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon icon={Scissor01Icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {serviceById(appointment.serviceId, services).name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatFullDay(appointment.date, locale)} · {appointment.time}
                        </p>
                      </div>
                      {appointment.outcome ? (
                        <StatusPill tone={outcomeTone[appointment.outcome]} className="shrink-0">
                          {outcomeLabel[appointment.outcome]}
                        </StatusPill>
                      ) : null}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader title={t.admin.detailRequestHistory} />
          <div className="mt-4">
            {requests.length === 0 ? (
              <EmptyState title={t.client.noRequestsYet} icon={<Icon icon={InboxIcon} />} />
            ) : (
              <ul className="divide-y">
                {[...requests]
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map((request) => {
                    const meta = requestStatusMeta[request.status];
                    const proposal = proposals.find((p) => p.id === request.proposalId);
                    return (
                      <li key={request.id} className="flex min-h-14 items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {serviceById(request.serviceId, services).name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {proposal
                              ? t.client.proposedAt(formatFullDay(proposal.date, locale), proposal.time)
                              : request.preferences
                                  .map((preference) => formatFullDay(preference.date, locale))
                                  .join(", ")}
                          </p>
                        </div>
                        <StatusPill tone={meta.tone} dot className="shrink-0">
                          {meta.label}
                        </StatusPill>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmAction === "block" ? t.admin.blockClient : t.admin.deleteClient}
        description={confirmAction === "block" ? t.admin.blockClientConfirm : t.admin.deleteClientConfirm}
        confirmLabel={
          pending ? t.common.working : confirmAction === "block" ? t.admin.blockClient : t.admin.deleteClient
        }
        loading={pending}
        onConfirm={() => {
          if (confirmAction === "block") {
            run(() => blockClientAction(client.id));
          } else if (confirmAction === "delete") {
            run(() => deleteClientAction(client.id), true);
          }
        }}
      />
    </div>
  );
}
