"use client";

import { Delete02Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";

import { deleteMyAccountAction, exportMyDataAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import { Separator } from "@/components/ui/separator";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";

// GDPR self-service: download a JSON copy of your data, or delete your account.
export function PrivacyControls() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  function exportData() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await exportMyDataAction();
        if (!result.ok) {
          setFeedback(result);
          return;
        }
        // Trigger a client-side download of the returned JSON.
        const blob = new Blob([result.data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "samuelsson-cuts-my-data.json";
        link.click();
        // Defer revocation so the browser has started the download first.
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function deleteAccount() {
    setFeedback(null);
    startTransition(async () => {
      try {
        // On success this redirects; only failures return here.
        const result = await deleteMyAccountAction();
        setFeedback(result);
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <SectionHeader eyebrow={t.profile.privacyEyebrow} title={t.profile.privacyTitle} />

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <Icon icon={Download04Icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t.profile.exportData}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.profile.exportHint}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={exportData}
            className="w-full shrink-0 sm:w-auto"
          >
            {pending ? t.profile.exporting : t.profile.exportData}
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Icon icon={Delete02Icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t.profile.deleteAccount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.profile.deleteAccountHint}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="dangerOutline"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="w-full shrink-0 sm:w-auto"
          >
            {t.profile.deleteAccount}
          </Button>
        </div>
      </div>

      <Feedback result={feedback} className="mt-4" />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.profile.deleteConfirmTitle}
        description={t.profile.deleteConfirmBody}
        confirmLabel={pending ? t.common.working : t.profile.deleteConfirmCta}
        cancelLabel={t.profile.keepAccount}
        loading={pending}
        onConfirm={deleteAccount}
      >
        <Feedback result={feedback && !feedback.ok ? feedback : null} />
      </ConfirmDialog>
    </Card>
  );
}
