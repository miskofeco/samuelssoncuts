"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

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
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-black dark:text-white" aria-live="polite">
          {monthLabel(month, locale)}
        </h3>
        <div className="flex items-center gap-1">
          <NavButton
            label={t.common.previousMonth}
            disabled={!canGoBack}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </NavButton>
          <button
            type="button"
            onClick={() => setMonth(monthKey(todayIso()))}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {t.common.today}
          </button>
          <NavButton
            label={t.common.nextMonth}
            disabled={!canGoForward}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="size-4" aria-hidden />
          </NavButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1" role={interactive ? "group" : undefined}>
        {weekdays.map((day) => (
          <div
            key={day}
            aria-hidden
            className="pb-1 text-center text-[0.7rem] font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400"
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
                  "text-xs font-semibold tabular-nums",
                  cell.inMonth ? "text-stone-700 dark:text-stone-300" : "text-stone-500 dark:text-stone-500",
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
            cell.inMonth
              ? "border-black/10 bg-white dark:border-white/10 dark:bg-stone-900"
              : "border-black/5 bg-white/70 dark:border-white/5 dark:bg-stone-900/45",
            dayClassName?.(cell),
            interactive && !disabled && "hover:border-black dark:hover:border-white",
            interactive && disabled && "cursor-not-allowed",
            selected && "border-black ring-2 ring-black dark:border-white dark:ring-white",
            cell.isToday && "ring-2 ring-black dark:ring-white",
            cell.isToday && selected && "ring-offset-2 ring-offset-white dark:ring-offset-stone-900",
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
              className={cn(cellClass, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white")}
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

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg border border-black/10 text-stone-600 transition hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-white/10 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      {children}
    </button>
  );
}
