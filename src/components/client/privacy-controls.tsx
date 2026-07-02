"use client";

import { useState, useTransition } from "react";

import { deleteMyAccountAction, exportMyDataAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Modal } from "@/components/shared/modal";
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
        URL.revokeObjectURL(url);
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
    <Card className="rounded-2xl p-5">
      <SectionHeader eyebrow={t.profile.privacyEyebrow} title={t.profile.privacyTitle} />

      <div className="mt-4 space-y-4">
        <div>
          <Button type="button" variant="secondary" disabled={pending} onClick={exportData}>
            {pending ? t.profile.exporting : t.profile.exportData}
          </Button>
          <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
            {t.profile.exportHint}
          </p>
        </div>

        <div className="border-t border-black/10 pt-4 dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            {t.profile.deleteAccount}
          </Button>
          <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
            {t.profile.deleteAccountHint}
          </p>
        </div>
      </div>

      <Feedback result={feedback} className="mt-3" />

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.profile.deleteConfirmTitle}
        description={t.profile.deleteConfirmBody}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            {t.profile.keepAccount}
          </Button>
          <Button type="button" variant="danger" disabled={pending} onClick={deleteAccount}>
            {pending ? t.common.working : t.profile.deleteConfirmCta}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
