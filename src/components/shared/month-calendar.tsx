"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import {
  monthGrid,
  monthKey,
  monthLabel,
  shiftMonth,
  todayIso,
  type MonthCell,
} from "@/domain/schedule";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

/**
 * Month grid with large tappable day cells. Consumers colour cells through
 * `dayClassName`/`renderDay`; the calendar itself only owns the frame, the
 * month navigation and the today/selected rings.
 */
export function MonthCalendar({
  initialMonth,
  month: controlledMonth,
  onMonthChange,
  minMonth,
  maxMonth,
  renderDay,
  dayClassName,
  dayNumberClassName,
  isDisabled,
  isSelected,
  onDayClick,
  className,
  footer,
}: {
  /** "yyyy-mm"; defaults to the current month (uncontrolled). */
  initialMonth?: string;
  /** Controlled month ("yyyy-mm"); pair with `onMonthChange`. */
  month?: string;
  onMonthChange?: (month: string) => void;
  /** Inclusive "yyyy-mm" bounds for navigation. */
  minMonth?: string;
  maxMonth?: string;
  /** Custom content rendered inside each day cell (below the date number). */
  renderDay?: (cell: MonthCell) => ReactNode;
  dayClassName?: (cell: MonthCell) => string;
  dayNumberClassName?: (cell: MonthCell) => string;
  /** Marks a day as not selectable (real `disabled`, skipped by Tab). */
  isDisabled?: (cell: MonthCell) => boolean;
  /** Marks the chosen day (`aria-pressed`). */
  isSelected?: (cell: MonthCell) => boolean;
  onDayClick?: (cell: MonthCell) => void;
  className?: string;
  footer?: ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const locale = localeFor(lang);
  const weekdays = t.weekdaysShort;
  const [internalMonth, setInternalMonth] = useState(initialMonth ?? monthKey(todayIso()));
  const month = controlledMonth ?? internalMonth;
  const cells = monthGrid(month);
  const interactive = Boolean(onDayClick);
  const canGoBack = !minMonth || shiftMonth(month, -1) >= minMonth;
  const canGoForward = !maxMonth || shiftMonth(month, 1) <= maxMonth;

  function setMonth(next: string) {
    if (minMonth && next < minMonth) return;
    if (maxMonth && next > maxMonth) return;
    setInternalMonth(next);
    onMonthChange?.(next);
  }

  const dayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-base font-semibold text-foreground capitalize" aria-live="polite">
          {monthLabel(month, locale)}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            aria-label={t.common.previousMonth}
            disabled={!canGoBack}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <Icon icon={ArrowLeft01Icon} className="size-[18px]" strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-3 text-xs font-semibold"
            onClick={() => setMonth(monthKey(todayIso()))}
          >
            {t.common.today}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label={t.common.nextMonth}
            disabled={!canGoForward}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <Icon icon={ArrowRight01Icon} className="size-[18px]" strokeWidth={2} />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1" role={interactive ? "group" : undefined}>
        {weekdays.map((day) => (
          <div
            key={day}
            aria-hidden
            className="pb-1 text-center text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {day}
          </div>
        ))}
        {cells.map((cell) => {
          const disabled = !interactive || (isDisabled?.(cell) ?? false);
          const selected = isSelected?.(cell) ?? false;
          const dayNumber = Number(cell.date.slice(8, 10));
          const cellContent = (
            <>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  cell.inMonth ? "text-foreground" : "text-muted-foreground/70",
                  dayNumberClassName?.(cell),
                )}
              >
                {dayNumber}
              </span>
              {renderDay ? <span className="mt-1 flex-1">{renderDay(cell)}</span> : null}
            </>
          );
          const cellClass = cn(
            "flex min-h-[68px] flex-col rounded-lg border p-1.5 text-left align-top transition",
            cell.inMonth ? "bg-card" : "border-border/60 bg-card/60",
            dayClassName?.(cell),
            interactive && !disabled && "hover:border-foreground active:scale-[0.97]",
            interactive && disabled && "cursor-not-allowed",
            selected && "border-foreground ring-2 ring-inset ring-foreground",
            cell.isToday && "ring-2 ring-inset ring-black dark:ring-white",
          );

          if (!interactive) {
            return (
              <div key={cell.date} className={cellClass} aria-label={dayFormatter.format(new Date(`${cell.date}T12:00:00`))}>
                {cellContent}
              </div>
            );
          }

          return (
            <button
              key={cell.date}
              type="button"
              disabled={disabled}
              aria-disabled={disabled || undefined}
              aria-pressed={selected}
              aria-current={cell.isToday ? "date" : undefined}
              aria-label={dayFormatter.format(new Date(`${cell.date}T12:00:00`))}
              onClick={() => onDayClick?.(cell)}
              className={cn(
                cellClass,
                "outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
              )}
            >
              {cellContent}
            </button>
          );
        })}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}
