"use client";

import { useMemo, useState, useTransition } from "react";

import { approveClientAction, rejectClientAction } from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay, serviceById } from "@/domain/schedule";
import type {
  ActionResult,
  BookingRequest,
  ClientProfile,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

export function ApprovalQueue({
  clients,
  requests,
  services,
}: {
  clients: ClientProfile[];
  requests: BookingRequest[];
  services: Service[];
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const [pendingTransition, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  const people = useMemo(
    () => clients.filter((client) => client.role !== "admin"),
    [clients],
  );
  const pending = people.filter(
    (client) => client.status === "pending" && client.emailConfirmed,
  );
  const awaitingVerification = people.filter(
    (client) => client.status === "pending" && !client.emailConfirmed,
  ).length;

  function run(action: (id: string) => Promise<ActionResult>, id: string) {
    setFeedback(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await action(id);
      setBusyId(null);
      setFeedback(result);
    });
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow={t.admin.approvalsEyebrow}
        title={t.admin.pendingApprovals}
        action={
          pending.length > 0 ? (
            <StatusPill tone="warning">{t.admin.waiting(pending.length)}</StatusPill>
          ) : (
            <StatusPill tone="success">{t.admin.allClear}</StatusPill>
          )
        }
      />

      <Feedback result={feedback} className="mt-4" />

      {awaitingVerification > 0 ? (
        <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
          {t.admin.awaitingVerification(awaitingVerification)}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {pending.length === 0 ? (
          <EmptyState
            title={t.admin.noVerifiedWaiting}
            description={t.admin.noVerifiedDescription}
          />
        ) : (
          pending.map((client) => {
            const busy = pendingTransition && busyId === client.id;
            const clientRequests = requests.filter(
              (request) => request.clientId === client.id,
            );
            return (
              <div
                key={client.id}
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={client.name} src={client.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-black dark:text-white">
                      {client.name}
                    </p>
                    <p className="truncate text-sm text-stone-500 dark:text-stone-400">
                      {client.email}
                    </p>
                    {client.phone ? (
                      <p className="truncate text-xs text-stone-400 dark:text-stone-500">
                        {client.phone}
                      </p>
                    ) : null}
                  </div>
                </div>

                {clientRequests.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-white/70 p-3 dark:bg-stone-900/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      {t.admin.requested}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {clientRequests.slice(0, 2).map((request) => (
                        <div key={request.id} className="text-sm text-stone-600 dark:text-stone-300">
                          <span className="font-medium">
                            {serviceById(request.serviceId, services).name}
                          </span>{" "}
                          —{" "}
                          {request.preferences
                            .map((preference) => formatFullDay(preference.date, locale))
                            .join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => run(approveClientAction, client.id)}
                  >
                    {busy ? t.common.working : t.admin.approve}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={Boolean(busy)}
                    onClick={() => run(rejectClientAction, client.id)}
                  >
                    {t.admin.reject}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
