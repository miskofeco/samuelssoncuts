"use client";

import { Coins01Icon } from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";

import { savePricingSettingsAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { priceForSlot } from "@/domain/schedule";
import type { ActionResult, PricingSettings } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

export function PricingSettingsForm({
  initialSettings,
  exampleBasePrice,
}: {
  initialSettings: PricingSettings;
  /** Base price (€) of a real service for the live example; omitted → no preview. */
  exampleBasePrice?: number;
}) {
  const t = useT();
  const [draft, setDraft] = useState({
    gapSurchargePercent: String(initialSettings.gapSurchargePercent),
    vipSurchargePercent: String(initialSettings.vipSurchargePercent),
  });
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  const gapPercent = Number(draft.gapSurchargePercent);
  const vipPercent = Number(draft.vipSurchargePercent);
  const previewReady =
    exampleBasePrice !== undefined && Number.isFinite(gapPercent) && Number.isFinite(vipPercent);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        setFeedback(
          await savePricingSettingsAction({
            gapSurchargePercent: Number(draft.gapSurchargePercent),
            vipSurchargePercent: Number(draft.vipSurchargePercent),
          }),
        );
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <SectionHeader
        eyebrow={t.admin.pricingEyebrow}
        title={t.admin.pricingTitle}
        description={t.admin.pricingDescription}
      />
      <form onSubmit={save} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            type="number"
            inputMode="numeric"
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
            inputMode="numeric"
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

        {previewReady ? (
          <div className="rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Icon icon={Coins01Icon} className="size-3.5" />
              {t.admin.pricingExampleTitle(exampleBasePrice)}
            </p>
            <dl className="mt-2 divide-y text-sm">
              <PreviewRow label={t.admin.pricingExampleBase} price={exampleBasePrice} tone="emerald" />
              <PreviewRow
                label={`${t.admin.pricingExampleGap} · +${Math.max(0, gapPercent)}%`}
                price={priceForSlot(exampleBasePrice, false, {
                  startsAt: "10:00",
                  gapSurchargePercent: gapPercent,
                  vipSurchargePercent: vipPercent,
                })}
                tone="amber"
              />
              <PreviewRow
                label={`${t.admin.pricingExampleVip} · +${Math.max(0, vipPercent)}%`}
                price={priceForSlot(exampleBasePrice, false, {
                  startsAt: "17:00",
                  gapSurchargePercent: gapPercent,
                  vipSurchargePercent: vipPercent,
                })}
                tone="sky"
              />
            </dl>
          </div>
        ) : null}

        <Feedback result={feedback} />
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
            {pending ? t.common.saving : t.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

const previewTones = {
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  sky: "text-sky-700 dark:text-sky-300",
};

function PreviewRow({
  label,
  price,
  tone,
}: {
  label: string;
  price: number;
  tone: keyof typeof previewTones;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
      <dd className={cn("shrink-0 font-semibold tabular-nums", previewTones[tone])}>{price} €</dd>
    </div>
  );
}
