"use client";

import { useState, useTransition } from "react";

import { saveBusinessHoursAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { Toggle } from "@/components/shared/toggle";
import type { BusinessHoursDay } from "@/domain/types";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

export function BusinessHoursEditor({
  initialHours,
  locale,
}: {
  initialHours: BusinessHoursDay[];
  locale: string;
}) {
  const t = useT();
  void locale;

  const [days, setDays] = useState<BusinessHoursDay[]>(
    // Ensure all 7 days present (Sun-Sat order by weekday number).
    Array.from({ length: 7 }, (_, w) => {
      return initialHours.find((d) => d.weekday === w) ?? {
        weekday: w,
        opensAt: "07:00",
        closesAt: "21:00",
        closed: w === 0,
      };
    }),
  );

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function update(weekday: number, patch: Partial<BusinessHoursDay>) {
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)),
    );
  }

  const invalidWeekdays = new Set(
    days.filter((day) => !day.closed && day.closesAt <= day.opensAt).map((day) => day.weekday),
  );

  function applyToAllOpenDays() {
    const source = days.find((day) => !day.closed);
    if (!source) return;
    setDays((current) =>
      current.map((day) =>
        day.closed ? day : { ...day, opensAt: source.opensAt, closesAt: source.closesAt },
      ),
    );
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidWeekdays.size > 0) return;
    setFeedback(null);
    startTransition(async () => {
      setFeedback(await saveBusinessHoursAction(days));
    });
  }

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow={t.admin.availabilityEyebrow}
        title={t.admin.businessHoursTitle}
      />
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        {t.admin.businessHoursDescription}
      </p>

      <form className="mt-5 space-y-2" onSubmit={save}>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={applyToAllOpenDays}>
            {t.admin.businessHoursApplyAll}
          </Button>
        </div>
        {days.map((day) => (
          <div
            key={day.weekday}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
              day.closed
                ? "border-stone-100 bg-stone-50 dark:border-white/5 dark:bg-stone-800/30"
                : "border-black/10 bg-white dark:border-white/10 dark:bg-stone-900",
            )}
          >
            {/* Day label — fixed width so columns align */}
            <span
              className={cn(
                "w-28 shrink-0 text-sm font-semibold",
                day.closed ? "text-stone-400 dark:text-stone-500" : "text-black dark:text-white",
              )}
            >
              {t.admin.weekdayNames[day.weekday]}
            </span>

            {/* Open/Closed toggle */}
            <div className="flex items-center gap-2">
              <Toggle
                checked={!day.closed}
                onChange={(checked) => update(day.weekday, { closed: !checked })}
                label={`${t.admin.weekdayNames[day.weekday]}: ${day.closed ? t.admin.businessHoursClosed : t.admin.businessHoursOpen}`}
              />
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {day.closed ? t.admin.businessHoursClosed : t.admin.businessHoursOpen}
              </span>
            </div>

            {/* Time pickers */}
            {!day.closed ? (
              <div className="ml-auto grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                <Field
                  label={t.admin.from}
                  type="time"
                  step={1800}
                  value={day.opensAt}
                  onChange={(e) => update(day.weekday, { opensAt: e.target.value })}
                />
                <span className="mt-10 text-sm text-stone-400">–</span>
                <Field
                  label={t.admin.to}
                  type="time"
                  step={1800}
                  value={day.closesAt}
                  onChange={(e) => update(day.weekday, { closesAt: e.target.value })}
                  error={invalidWeekdays.has(day.weekday) ? t.admin.businessHoursInvalid : undefined}
                />
              </div>
            ) : null}
          </div>
        ))}
        <Feedback result={feedback} className="mt-4" />
        <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending || invalidWeekdays.size > 0}>
          {pending ? t.common.saving : t.admin.businessHoursSave}
        </Button>
        </div>
      </form>
    </Card>
  );
}
