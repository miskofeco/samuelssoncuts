"use client";

import { useState, useTransition } from "react";

import { blockDateAction, unblockDateAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { MonthCalendar } from "@/components/shared/month-calendar";
import { StatusPill } from "@/components/shared/status-pill";
import { addDays, formatFullDay } from "@/domain/schedule";
import type { ActionResult } from "@/domain/types";
import { cn } from "@/lib/classnames";

type BlockedRange = { id: string; start: string; end: string; reason: string | null };

export function AvailabilityManager({
  ranges,
  blockedDates,
}: {
  ranges: BlockedRange[];
  blockedDates: Set<string>;
}) {
  const [start, setStart] = useState(addDays(1));
  const [end, setEnd] = useState(addDays(1));
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function block() {
    setFeedback(null);
    startTransition(async () => {
      const result = await blockDateAction({ start, end, reason: reason || undefined });
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
      <Card className="rounded-2xl p-5">
        <SectionHeader eyebrow="Vacation" title="Block dates" />
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Blocked days are hidden from clients when they pick preferred dates.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            type="date"
            label="From"
            value={start}
            min={addDays(0)}
            onChange={(event) => {
              setStart(event.target.value);
              if (event.target.value > end) setEnd(event.target.value);
            }}
          />
          <Field
            type="date"
            label="To"
            value={end}
            min={start}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
        <Field
          label="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Holiday, training, …"
          className="mt-3"
        />

        <Feedback result={feedback} className="mt-3" />

        <Button type="button" onClick={block} disabled={pending} className="mt-3">
          {pending ? "Saving…" : "Block these dates"}
        </Button>

        <div className="mt-6">
          <MonthCalendar
            renderDay={(cell) =>
              blockedDates.has(cell.date) ? (
                <span className="mt-1 block rounded bg-red-100 px-1 py-0.5 text-center text-[0.6rem] font-semibold uppercase text-red-700 dark:bg-red-500/20 dark:text-red-300">
                  Off
                </span>
              ) : null
            }
          />
        </div>
      </Card>

      <Card className="rounded-2xl p-5">
        <SectionHeader
          title="Blocked periods"
          action={<StatusPill tone={ranges.length > 0 ? "danger" : "success"}>{ranges.length}</StatusPill>}
        />
        <div className="mt-4 space-y-2">
          {ranges.length === 0 ? (
            <EmptyState title="No blocked dates" description="Your full calendar is open for bookings." />
          ) : (
            ranges.map((range) => (
              <div
                key={range.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-stone-900",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black dark:text-white">
                    {range.start === range.end
                      ? formatFullDay(range.start)
                      : `${formatFullDay(range.start)} → ${formatFullDay(range.end)}`}
                  </p>
                  {range.reason ? (
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                      {range.reason}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => unblock(range.id)}
                  className="shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  Reopen
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
