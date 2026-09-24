"use client";

import {
  BlockedIcon,
  CalendarCheckIn01Icon,
  CalendarRemove01Icon,
  UnavailableIcon,
} from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";

import { blockDateAction, unblockDateAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { DateField, isoToLocalDate, localDateToIso } from "@/components/shared/date-field";
import { Field } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { DAY_PICKER_LOCALES, ScheduleCalendar } from "@/components/shared/schedule-calendar";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { StatusPill } from "@/components/shared/status-pill";
import { Calendar } from "@/components/ui/calendar";
import { addDays, formatBlockedRange, formatFullDay, monthKey } from "@/domain/schedule";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ActionResult, BlockedRange } from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

export function AvailabilityManager({
  ranges,
  blockedDates,
}: {
  ranges: BlockedRange[];
  blockedDates: Set<string>;
}) {
  const t = useT();
  const lang = useLang();
  const locale = localeFor(lang);
  const isMobile = useIsMobile();
  const today = addDays(0);
  const [start, setStart] = useState(addDays(1));
  const [end, setEnd] = useState(addDays(1));
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"days" | "slice">("days");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const sliceMode = mode === "slice";
  const invalidRange = sliceMode ? endTime <= startTime : end < start;
  const visibleRanges = ranges.filter((range) => range.end >= today);

  function block(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidRange) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await blockDateAction({
          start,
          end: sliceMode ? start : end,
          reason: reason || undefined,
          ...(sliceMode ? { startTime, endTime } : {}),
        });
        setFeedback(result);
        if (result.ok) setReason("");
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function unblock(id: string) {
    setFeedback(null);
    startTransition(async () => {
      try {
        setFeedback(await unblockDateAction(id));
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
      <Card className="rounded-2xl">
        <SectionHeader
          eyebrow={t.admin.vacation}
          title={t.admin.blockDates}
          description={t.admin.blockDatesDescription}
        />

        {/* Whole days: drag a range on a two-month range calendar. Time slice:
            pick the single day, then set the hours below. Already blocked days
            are marked so the barber does not double-block them. */}
        <div className="mt-4">
          {sliceMode ? (
            <ScheduleCalendar
              startMonth={monthKey(today)}
              selected={start}
              onSelect={(iso) => {
                setStart(iso);
                setEnd(iso);
              }}
              disabled={{ before: isoToLocalDate(today)! }}
              modifiers={{ blocked: (day) => blockedDates.has(localDateToIso(day)) }}
              dayClassName={({ modifiers }) =>
                modifiers.blocked && !modifiers.selected
                  ? "border-red-300 bg-red-50 text-red-900 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-100"
                  : undefined
              }
              renderDay={({ modifiers }) =>
                modifiers.blocked ? (
                  <>
                    <Icon icon={BlockedIcon} className="size-3" strokeWidth={2.5} />
                    <span className="sr-only">{t.admin.off}</span>
                  </>
                ) : null
              }
            />
          ) : (
            <Calendar
              mode="range"
              numberOfMonths={isMobile ? 1 : 2}
              locale={DAY_PICKER_LOCALES[lang]}
              weekStartsOn={1}
              defaultMonth={isoToLocalDate(start)}
              selected={{ from: isoToLocalDate(start), to: isoToLocalDate(end) }}
              onSelect={(range) => {
                if (!range?.from) return;
                const from = localDateToIso(range.from);
                setStart(from);
                setEnd(range.to ? localDateToIso(range.to) : from);
              }}
              disabled={{ before: isoToLocalDate(today)! }}
              modifiers={{ blocked: (day) => blockedDates.has(localDateToIso(day)) }}
              modifiersClassNames={{
                blocked:
                  "[&>button]:underline [&>button]:decoration-red-500 [&>button]:decoration-2 [&>button]:underline-offset-4 [&>button:not([data-selected-single=true]):not([data-range-start=true]):not([data-range-end=true])]:text-red-700 dark:[&>button:not([data-selected-single=true]):not([data-range-start=true]):not([data-range-end=true])]:text-red-300",
              }}
              className="w-full bg-transparent p-0 [--cell-size:--spacing(10)]"
              classNames={{
                root: "w-full",
                months: "relative flex w-full flex-col gap-6 md:flex-row md:gap-8",
                month: "flex w-full min-w-0 flex-1 flex-col gap-3",
                month_caption: "flex h-9 w-full items-center justify-center px-9",
                caption_label: "text-base font-semibold capitalize select-none",
                nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday:
                  "flex-1 pb-1 text-center text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase select-none",
                week: "mt-1 flex w-full",
                day: "group/day relative aspect-square min-w-0 flex-1 p-0 text-center select-none [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
              }}
            />
          )}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-red-500" />
            {t.admin.off}
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {sliceMode
                ? formatFullDay(start, locale)
                : start === end
                  ? formatFullDay(start, locale)
                  : `${formatFullDay(start, locale)} – ${formatFullDay(end, locale)}`}
            </span>
          </p>
        </div>

        <form className="mt-5 space-y-4 border-t pt-5" onSubmit={block}>
          <SegmentedControl
            ariaLabel={t.admin.availabilityMode}
            value={mode}
            onChange={setMode}
            options={[
              { value: "days", label: t.admin.availabilityDays },
              { value: "slice", label: t.admin.availabilityTimeSlice },
            ]}
            className="sm:max-w-sm"
          />
          <div className={sliceMode ? "grid min-w-0 gap-3" : "grid min-w-0 gap-3 sm:grid-cols-2"}>
            <DateField
              className="min-w-0"
              label={t.admin.from}
              value={start}
              min={addDays(0)}
              onChange={(next) => {
                setStart(next);
                if (next > end) setEnd(next);
              }}
            />
            {sliceMode ? (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Field
                  className="min-w-0"
                  type="time"
                  label={t.admin.startTime}
                  value={startTime}
                  step={1800}
                  onChange={(event) => setStartTime(event.target.value)}
                />
                <Field
                  className="min-w-0"
                  type="time"
                  label={t.admin.endTime}
                  value={endTime}
                  step={1800}
                  onChange={(event) => setEndTime(event.target.value)}
                  error={invalidRange ? t.admin.availabilityInvalidRange : undefined}
                />
              </div>
            ) : (
              <DateField
                label={t.admin.to}
                value={end}
                min={start}
                onChange={setEnd}
                error={invalidRange ? t.admin.availabilityInvalidRange : undefined}
              />
            )}
          </div>
          <Field
            label={`${t.admin.reason} ${t.common.optional}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t.admin.reasonPlaceholder}
          />

          <Feedback result={feedback} />

          <Button
            type="submit"
            size="lg"
            variant="destructive"
            disabled={invalidRange}
            loading={pending}
            className="w-full sm:w-auto"
          >
            {pending ? (
              t.common.saving
            ) : (
              <>
                <Icon icon={UnavailableIcon} strokeWidth={2} />
                {sliceMode ? t.admin.blockThisSlot : t.admin.blockTheseDates}
              </>
            )}
          </Button>
        </form>
      </Card>

      <Card className="rounded-2xl">
        <SectionHeader
          title={t.admin.blockedPeriods}
          action={
            <StatusPill tone={visibleRanges.length > 0 ? "danger" : "success"} dot>
              {visibleRanges.length}
            </StatusPill>
          }
        />
        <div className="mt-4 space-y-2">
          {visibleRanges.length === 0 ? (
            <EmptyState
              title={t.admin.noBlockedDates}
              description={t.admin.noBlockedDescription}
              icon={<Icon icon={CalendarCheckIn01Icon} />}
            />
          ) : (
            <ul className="space-y-2">
              {visibleRanges.map((range) => (
                <li
                  key={range.id}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <Icon icon={CalendarRemove01Icon} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {formatBlockedRange(range, locale)}
                    </p>
                    {range.reason ? (
                      <p className="truncate text-xs text-muted-foreground">{range.reason}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => unblock(range.id)}
                    className="h-9 shrink-0"
                  >
                    {t.admin.reopen}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
