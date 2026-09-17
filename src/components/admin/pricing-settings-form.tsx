"use client";

import { useState, useTransition } from "react";

import { savePricingSettingsAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import type { ActionResult, PricingSettings } from "@/domain/types";
import { useT } from "@/i18n/provider";

export function PricingSettingsForm({
  initialSettings,
}: {
  initialSettings: PricingSettings;
}) {
  const t = useT();
  const [draft, setDraft] = useState({
    gapSurchargePercent: String(initialSettings.gapSurchargePercent),
    vipSurchargePercent: String(initialSettings.vipSurchargePercent),
  });
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setFeedback(
        await savePricingSettingsAction({
          gapSurchargePercent: Number(draft.gapSurchargePercent),
          vipSurchargePercent: Number(draft.vipSurchargePercent),
        }),
      );
    });
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow={t.admin.pricingEyebrow}
        title={t.admin.pricingTitle}
      />
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        {t.admin.pricingDescription}
      </p>
      <form onSubmit={save}>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          type="number"
          min={0}
          max={500}
          step={1}
          label={t.admin.gapSurchargePercent}
          value={draft.gapSurchargePercent}
          onChange={(event) =>
            setDraft({ ...draft, gapSurchargePercent: event.target.value })
          }
        />
        <Field
          type="number"
          min={0}
          max={500}
          step={1}
          label={t.admin.vipSurchargePercent}
          value={draft.vipSurchargePercent}
          onChange={(event) =>
            setDraft({ ...draft, vipSurchargePercent: event.target.value })
          }
        />
      </div>
      <Feedback result={feedback} className="mt-4" />
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </div>
      </form>
    </Card>
  );
}
