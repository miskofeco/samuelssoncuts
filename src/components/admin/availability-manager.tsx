"use client";

import { CalendarCheckIn01Icon, CalendarRemove01Icon, UnavailableIcon } from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";

import { blockDateAction, unblockDateAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { MonthCalendar } from "@/components/shared/month-calendar";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { StatusPill } from "@/components/shared/status-pill";
import { addDays, formatFullDay } from "@/domain/schedule";
import type { ActionResult } from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

type BlockedRange = { id: string; start: string; end: string; reason: string | null };

export function AvailabilityManager({
  ranges,
  blockedDates,
}: {
  ranges: BlockedRange[];
  blockedDates: Set<string>;
}) {
  const t = useT();
  const locale = localeFor(useLang());
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
      const result = await blockDateAction({
        start,
        end: sliceMode ? start : end,
        reason: reason || undefined,
        ...(sliceMode ? { startTime, endTime } : {}),
      });
      setFeedback(result);
      if (result.ok) setReason("");
    });
  }

  function unblock(id: string) {
    setFeedback(null);
    startTransition(async () => {
      setFeedback(await unblockDateAction(id));
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

        {/* Pick a day on the calendar first, then fine-tune the range below. */}
        <div className="mt-4">
          <MonthCalendar
            isDisabled={(cell) => cell.date < today}
            isSelected={(cell) => cell.date === start}
            onDayClick={(cell) => {
              setStart(cell.date);
              setEnd(cell.date);
            }}
            dayClassName={(cell) =>
              cell.date < today
                ? "cursor-not-allowed border-dashed !border-stone-400 !bg-stone-200 dark:!border-stone-700 dark:!bg-stone-800"
                : blockedDates.has(cell.date)
                  ? "border-2 border-red-300 bg-red-50 dark:border-red-500/60 dark:bg-red-500/15"
                : ""
            }
            dayNumberClassName={(cell) =>
              cell.date < today
                ? "text-stone-400 dark:text-stone-500"
                : blockedDates.has(cell.date)
                  ? "text-red-900 dark:text-red-100"
                : ""
            }
            renderDay={(cell) =>
              blockedDates.has(cell.date) ? (
                <span
                  aria-label={t.admin.off}
                  className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700 dark:bg-red-500/20 dark:text-red-200"
                >
                  <span aria-hidden="true">x</span>
                  <span className="sr-only">{t.admin.off}</span>
                </span>
              ) : null
            }
          />
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              type="date"
              label={t.admin.from}
              value={start}
              min={addDays(0)}
              onChange={(event) => {
                setStart(event.target.value);
                if (event.target.value > end) setEnd(event.target.value);
              }}
            />
            {sliceMode ? (
              <div className="grid grid-cols-2 gap-3">
                <Field
                  type="time"
                  label={t.admin.startTime}
                  value={startTime}
                  step={1800}
                  onChange={(event) => setStartTime(event.target.value)}
                />
                <Field
                  type="time"
                  label={t.admin.endTime}
                  value={endTime}
                  step={1800}
                  onChange={(event) => setEndTime(event.target.value)}
                  error={invalidRange ? t.admin.availabilityInvalidRange : undefined}
                />
              </div>
            ) : (
              <Field
                type="date"
                label={t.admin.to}
                value={end}
                min={start}
                onChange={(event) => setEnd(event.target.value)}
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
                      {range.start === range.end
                        ? formatFullDay(range.start, locale)
                        : `${formatFullDay(range.start, locale)} → ${formatFullDay(range.end, locale)}`}
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
