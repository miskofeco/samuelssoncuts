"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import {
  formatDay,
  formatMonth,
  getAvailability,
  getAvailabilityTone,
  monthGrid,
  monthKey,
  shiftMonth,
  todayIso,
} from "@/domain/schedule";
import type { AppState, DayWindow, Preference } from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

const windows: DayWindow[] = ["Morning", "Midday", "Afternoon", "Evening"];

export function PreferencePicker({
  preferences,
  state,
  blockedDates,
  updatePreferenceDate,
  updatePreferenceWindow,
}: {
  preferences: Preference[];
  state: AppState;
  blockedDates: ReadonlySet<string>;
  updatePreferenceDate: (rank: number, date: string) => void;
  updatePreferenceWindow: (rank: number, window: DayWindow) => void;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const today = todayIso();
  const [month, setMonth] = useState(() => monthKey(preferences[0]?.date ?? today));
  const [activeRank, setActiveRank] = useState(1);

  const cells = monthGrid(month);
  const rankByDate = new Map(preferences.map((preference) => [preference.date, preference.rank]));

  function handleDayClick(date: string) {
    const existing = rankByDate.get(date);
    if (existing) {
      // Re-activate an already-picked day so the user can change its window or replace it.
      setActiveRank(existing);
      return;
    }
    updatePreferenceDate(activeRank, date);
    setActiveRank((rank) => (rank < 3 ? rank + 1 : 3));
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-stone-900 sm:p-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Month calendar */}
        <div className="flex w-full flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-black dark:text-white">
              {formatMonth(`${month}-01`, locale)}
            </h3>
            <div className="flex items-center gap-1">
              <NavButton label={t.common.previousMonth} onClick={() => setMonth(shiftMonth(month, -1))}>
                <path d="M15 18l-6-6 6-6" />
              </NavButton>
              <button
                type="button"
                onClick={() => setMonth(monthKey(today))}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                {t.common.today}
              </button>
              <NavButton label={t.common.nextMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
                <path d="M9 18l6-6-6-6" />
              </NavButton>
            </div>
          </div>

          <div className="mt-4 grid flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(3.5rem,1fr))] gap-1">
            {t.weekdaysMini.map((day, index) => (
              <div
                key={index}
                className="pb-1 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500"
              >
                {day}
              </div>
            ))}

            {cells.map((cell) => {
              const dayNumber = Number(cell.date.slice(8, 10));

              if (!cell.inMonth) {
                return (
                  <div
                    key={cell.date}
                    aria-hidden
                    className="flex h-full items-center justify-center text-sm text-stone-300 dark:text-stone-700"
                  >
                    {dayNumber}
                  </div>
                );
              }

              const availability = getAvailability(state, cell.date, blockedDates);
              const tone = getAvailabilityTone(availability);
              const rank = rankByDate.get(cell.date);
              const selected = rank !== undefined;
              const isPast = cell.date < today;
              const selectable = !isPast && !availability.blocked && availability.available > 0;

              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={!selectable && !selected}
                  onClick={() => handleDayClick(cell.date)}
                  aria-label={`${formatDay(cell.date, locale)} — ${
                    selected
                      ? t.client.choice(rank)
                      : selectable
                        ? t.client.availabilityLabel
                        : t.client.unavailable
                  }`}
                  className={cn(
                    "relative flex h-full items-center justify-center rounded-lg text-sm tabular-nums transition",
                    selected &&
                      "bg-black font-semibold text-white dark:bg-white dark:text-black",
                    !selected &&
                      selectable &&
                      "text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800",
                    !selected &&
                      !selectable &&
                      "cursor-not-allowed text-stone-300 dark:text-stone-600",
                    cell.isToday && !selected && "ring-1 ring-inset ring-black/40 dark:ring-white/40",
                  )}
                >
                  {dayNumber}
                  {selected ? (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[0.6rem] font-bold text-black ring-1 ring-black dark:bg-stone-900 dark:text-white dark:ring-white">
                      {rank}
                    </span>
                  ) : tone === "busy" && selectable ? (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[0.7rem] text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-black dark:bg-white" />
              {t.client.selected}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {t.client.limited}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
              {t.client.unavailable}
            </span>
          </div>
        </div>

        {/* Ranked choices + time window */}
        <div className="space-y-3">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t.client.pickDayPrefix}{" "}
            <span className="font-semibold text-black dark:text-white">
              {t.client.choice(activeRank)}
            </span>
            , {t.client.pickWindowSuffix}
          </p>

          {[...preferences]
            .sort((a, b) => a.rank - b.rank)
            .map((preference) => {
              const active = preference.rank === activeRank;
              return (
                <div
                  key={preference.id}
                  className={cn(
                    "rounded-xl border p-3 transition",
                    active
                      ? "border-black bg-stone-50 dark:border-white dark:bg-stone-800/60"
                      : "border-black/10 dark:border-white/10",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveRank(preference.rank)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span>
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                        {t.client.choice(preference.rank)}
                      </span>
                      <span className="block text-sm font-semibold text-black dark:text-white">
                        {formatDay(preference.date, locale)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                        active
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "border border-black/15 text-stone-500 dark:border-white/20 dark:text-stone-400",
                      )}
                    >
                      {preference.rank}
                    </span>
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {windows.map((window) => (
                      <button
                        key={window}
                        type="button"
                        onClick={() => {
                          updatePreferenceWindow(preference.rank, window);
                          setActiveRank(preference.rank);
                        }}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
                          preference.window === window
                            ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-black/10 text-stone-600 hover:border-black dark:border-white/15 dark:text-stone-300 dark:hover:border-white",
                        )}
                      >
                        {t.windows[window]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
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
