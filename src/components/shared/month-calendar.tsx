"use client";

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
import { cn } from "@/lib/classnames";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendar({
  initialMonth,
  renderDay,
  onDayClick,
  className,
  footer,
}: {
  /** "yyyy-mm"; defaults to the current month. */
  initialMonth?: string;
  /** Custom content rendered inside each in-month day cell (below the date number). */
  renderDay?: (cell: MonthCell) => ReactNode;
  onDayClick?: (cell: MonthCell) => void;
  className?: string;
  footer?: ReactNode;
}) {
  const [month, setMonth] = useState(initialMonth ?? monthKey(todayIso()));
  const cells = monthGrid(month);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-black dark:text-white">
          {monthLabel(month)}
        </h3>
        <div className="flex items-center gap-1">
          <NavButton label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            <path d="M15 18l-6-6 6-6" />
          </NavButton>
          <button
            type="button"
            onClick={() => setMonth(monthKey(todayIso()))}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            Today
          </button>
          <NavButton label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            <path d="M9 18l6-6-6-6" />
          </NavButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {weekdays.map((day) => (
          <div
            key={day}
            className="pb-1 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500"
          >
            {day}
          </div>
        ))}
        {cells.map((cell) => (
          <button
            key={cell.date}
            type="button"
            disabled={!onDayClick}
            onClick={onDayClick ? () => onDayClick(cell) : undefined}
            className={cn(
              "flex min-h-[68px] flex-col rounded-lg border p-1.5 text-left align-top transition",
              cell.inMonth
                ? "border-black/10 bg-white dark:border-white/10 dark:bg-stone-900"
                : "border-transparent bg-transparent opacity-40",
              onDayClick && cell.inMonth && "hover:border-black dark:hover:border-white",
              cell.isToday && "ring-2 ring-black dark:ring-white",
            )}
          >
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                cell.inMonth ? "text-stone-700 dark:text-stone-300" : "text-stone-400",
              )}
            >
              {Number(cell.date.slice(8, 10))}
            </span>
            {cell.inMonth && renderDay ? (
              <span className="mt-1 flex-1">{renderDay(cell)}</span>
            ) : null}
          </button>
        ))}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-stone-600 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
