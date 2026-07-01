"use client";

import { useState, useTransition } from "react";

import { saveBusinessHoursAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import type { BusinessHoursDay } from "@/domain/types";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

// Full day names: index 0 = Sunday, matching JS Date.getDay().
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SK = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];

function timeOptions() {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
}
const TIME_OPTIONS = timeOptions();

export function BusinessHoursEditor({
  initialHours,
  locale,
}: {
  initialHours: BusinessHoursDay[];
  locale: string;
}) {
  const t = useT();
  const isSk = locale.startsWith("sk");
  const dayNames = isSk ? DAY_NAMES_SK : DAY_NAMES_EN;

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

  function save() {
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

      <div className="mt-5 space-y-2">
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
              {dayNames[day.weekday]}
            </span>

            {/* Open/Closed toggle */}
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <span
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition",
                  day.closed ? "bg-stone-300 dark:bg-stone-600" : "bg-stone-900 dark:bg-white",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!day.closed}
                  onChange={(e) => update(day.weekday, { closed: !e.target.checked })}
                />
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition dark:bg-stone-900",
                    day.closed ? "translate-x-0.5" : "translate-x-4",
                  )}
                />
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {day.closed ? t.admin.businessHoursClosed : t.admin.businessHoursOpen}
              </span>
            </label>

            {/* Time pickers */}
            {!day.closed ? (
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={day.opensAt}
                  onChange={(e) => update(day.weekday, { opensAt: e.target.value })}
                  className="h-9 rounded-lg border border-black/10 bg-white px-2 text-sm text-black outline-none transition focus:border-black dark:border-white/15 dark:bg-stone-900 dark:text-white"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <span className="text-sm text-stone-400">–</span>
                <select
                  value={day.closesAt}
                  onChange={(e) => update(day.weekday, { closesAt: e.target.value })}
                  className="h-9 rounded-lg border border-black/10 bg-white px-2 text-sm text-black outline-none transition focus:border-black dark:border-white/15 dark:bg-stone-900 dark:text-white"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <Feedback result={feedback} className="mt-4" />

      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? t.common.saving : t.admin.businessHoursSave}
        </Button>
      </div>
    </Card>
  );
}
