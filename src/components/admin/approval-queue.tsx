"use client";

import {
  Call02Icon,
  Cancel01Icon,
  HourglassIcon,
  Mail01Icon,
  Tick02Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveClientAction, rejectClientAction } from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import type { ActionResult, ClientProfile } from "@/domain/types";
import { useT } from "@/i18n/provider";

/**
 * Verified-but-unapproved clients as decision cards: who they are, how to
 * reach them, then approve / reject. Reject goes through the shared
 * ConfirmDialog.
 */
export function ApprovalQueue({ clients }: { clients: ClientProfile[] }) {
  const t = useT();
  const [, startTransition] = useTransition();
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [rejecting, setRejecting] = useState<ClientProfile | null>(null);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  const pending = clients.filter((client) => client.emailConfirmed);
  const awaitingVerification = clients.length - pending.length;

  function run(action: (id: string) => Promise<ActionResult>, id: string) {
    if (busyIds.has(id)) return;
    setFeedback(null);
    setBusyIds((current) => new Set(current).add(id));
    startTransition(async () => {
      try {
        const result = await action(id);
        setFeedback(result);
        if (result.ok) {
          toast.success(result.message);
          setRejecting(null);
        }
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      } finally {
        setBusyIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    });
  }

  return (
    <Card>
      <SectionHeader
        eyebrow={t.admin.approvalsEyebrow}
        title={t.admin.pendingApprovals}
        action={
          pending.length > 0 ? (
            <StatusPill tone="warning" dot>
              {t.admin.waiting(pending.length)}
            </StatusPill>
          ) : (
            <StatusPill tone="success" dot>
              {t.admin.allClear}
            </StatusPill>
          )
        }
      />

      <Feedback result={feedback} className="mt-4" />

      {awaitingVerification > 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          <Icon icon={HourglassIcon} className="mt-0.5" />
          <span>{t.admin.awaitingVerification(awaitingVerification)}</span>
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {pending.length === 0 ? (
          <EmptyState
            title={t.admin.noVerifiedWaiting}
            description={t.admin.noVerifiedDescription}
            icon={<Icon icon={UserCheck01Icon} />}
          />
        ) : (
          pending.map((client) => {
            const busy = busyIds.has(client.id);
            return (
              <article
                key={client.id}
                className="rounded-xl bg-card p-4 ring-1 ring-amber-500/35 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={client.name} src={client.avatarUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-base font-semibold text-foreground">{client.name}</p>
                      <StatusPill tone="warning" dot>
                        {t.statuses.approvalPending}
                      </StatusPill>
                    </div>
                    <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                      <li className="flex min-w-0 items-center gap-2">
                        <Icon icon={Mail01Icon} className="shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </li>
                      {client.phone ? (
                        <li className="flex min-w-0 items-center gap-2">
                          <Icon icon={Call02Icon} className="shrink-0" />
                          <span className="truncate tabular-nums">{client.phone}</span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                  <Button
                    type="button"
                    variant="dangerOutline"
                    size="lg"
                    disabled={busy}
                    onClick={() => setRejecting(client)}
                    className="sm:w-auto"
                  >
                    <Icon icon={Cancel01Icon} strokeWidth={2} />
                    {busy ? t.common.working : t.admin.reject}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    loading={busy}
                    onClick={() => run(approveClientAction, client.id)}
                    className="sm:w-auto"
                  >
                    {busy ? null : <Icon icon={Tick02Icon} strokeWidth={2.2} />}
                    {busy ? t.common.working : t.admin.approve}
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title={t.admin.confirmRejectTitle}
        description={t.admin.confirmRejectBody}
        confirmLabel={t.admin.reject}
        loading={rejecting ? busyIds.has(rejecting.id) : false}
        onConfirm={() => {
          if (rejecting) run(rejectClientAction, rejecting.id);
        }}
      />
    </Card>
  );
}
