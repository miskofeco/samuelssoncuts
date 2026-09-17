"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";

import { saveBusinessHoursAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { Toggle } from "@/components/shared/toggle";
import type { BusinessHoursDay } from "@/domain/types";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

// Monday-first display order; the underlying weekday numbers (0 = Sunday) and
// the array sent to the server are unchanged.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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

  const orderedDays = DISPLAY_ORDER.map((weekday) => days.find((d) => d.weekday === weekday)!);

  return (
    <Card className="rounded-2xl">
      <SectionHeader
        eyebrow={t.admin.availabilityEyebrow}
        title={t.admin.businessHoursTitle}
        description={t.admin.businessHoursDescription}
        action={
          <Button type="button" variant="outline" size="sm" onClick={applyToAllOpenDays} className="h-9">
            {t.admin.businessHoursApplyAll}
          </Button>
        }
      />

      <form className="mt-4" onSubmit={save}>
        <ul className="divide-y overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {orderedDays.map((day) => {
            const name = t.admin.weekdayNames[day.weekday];
            const invalid = invalidWeekdays.has(day.weekday);
            return (
              <li
                key={day.weekday}
                className={cn(
                  "flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:px-4",
                  day.closed ? "bg-muted/40" : "bg-card",
                )}
              >
                {/* Day + open/closed switch */}
                <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:shrink-0 sm:pt-1.5">
                  <Toggle
                    checked={!day.closed}
                    onChange={(checked) => update(day.weekday, { closed: !checked })}
                    label={`${name}: ${day.closed ? t.admin.businessHoursClosed : t.admin.businessHoursOpen}`}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        day.closed ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {day.closed ? t.admin.businessHoursClosed : t.admin.businessHoursOpen}
                    </p>
                  </div>
                </div>

                {/* Time pickers */}
                {!day.closed ? (
                  <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-start gap-2 sm:max-w-sm sm:ml-auto">
                    <Field
                      label={t.admin.from}
                      type="time"
                      step={1800}
                      value={day.opensAt}
                      onChange={(e) => update(day.weekday, { opensAt: e.target.value })}
                    />
                    <span aria-hidden className="mt-[2.25rem] text-sm text-muted-foreground">
                      –
                    </span>
                    <Field
                      label={t.admin.to}
                      type="time"
                      step={1800}
                      value={day.closesAt}
                      onChange={(e) => update(day.weekday, { closesAt: e.target.value })}
                      error={invalid ? t.admin.businessHoursInvalid : undefined}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <Feedback result={feedback} className="mt-4" />

        {/* Primary action: sticky above the phone tab bar, static from md */}
        <div className="sticky bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 md:static md:mx-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <Button
            type="submit"
            size="lg"
            disabled={invalidWeekdays.size > 0}
            loading={pending}
            className="w-full md:w-auto"
          >
            {pending ? (
              t.common.saving
            ) : (
              <>
                <Icon icon={Tick02Icon} strokeWidth={2.2} />
                {t.admin.businessHoursSave}
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
