"use client";

import { useMemo } from "react";

import { SegmentedControl } from "@/components/shared/segmented-control";
import {
  createCalendarDays,
  formatDay,
  formatMonth,
  getAvailability,
  getAvailabilityTone,
} from "@/domain/schedule";
import type { AppState, DayWindow, Preference, ViewMode } from "@/domain/types";
import { cn } from "@/lib/classnames";

export function PreferencePicker({
  preferences,
  selectedView,
  setSelectedView,
  state,
  blockedDates,
  updatePreferenceDate,
}: {
  preferences: Preference[];
  selectedView: ViewMode;
  setSelectedView: (view: ViewMode) => void;
  state: AppState;
  blockedDates: ReadonlySet<string>;
  updatePreferenceDate: (rank: number, date: string) => void;
}) {
  const calendarDays = useMemo(() => createCalendarDays(0, 28), []);

  return (
    <div className="rounded-lg border border-black/10 bg-[#fafafa] p-3 dark:border-white/10 dark:bg-stone-800/40 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Availability
          </p>
          <h3 className="text-lg font-semibold text-black dark:text-white">
            {formatMonth(calendarDays[0])}
          </h3>
        </div>
        <SegmentedControl
          ariaLabel="Date picker view"
          value={selectedView}
          onChange={setSelectedView}
          options={[
            { label: "Calendar", value: "calendar" },
            { label: "List", value: "list" },
          ]}
        />
      </div>

      <PreferenceRankBar preferences={preferences} />

      {selectedView === "calendar" ? (
        <CalendarPreferenceGrid
          calendarDays={calendarDays}
          preferences={preferences}
          state={state}
          blockedDates={blockedDates}
          updatePreferenceDate={updatePreferenceDate}
        />
      ) : (
        <AvailabilityList
          calendarDays={calendarDays}
          preferences={preferences}
          state={state}
          blockedDates={blockedDates}
          updatePreferenceDate={updatePreferenceDate}
        />
      )}
    </div>
  );
}

function PreferenceRankBar({ preferences }: { preferences: Preference[] }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {preferences.map((preference) => (
        <div
          key={preference.id}
          className="rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-stone-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Choice {preference.rank}
          </p>
          <p className="mt-1 text-sm font-semibold text-black dark:text-white">
            {formatDay(preference.date)}
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{preference.window}</p>
        </div>
      ))}
    </div>
  );
}

function CalendarPreferenceGrid({
  calendarDays,
  preferences,
  state,
  blockedDates,
  updatePreferenceDate,
}: {
  calendarDays: string[];
  preferences: Preference[];
  state: AppState;
  blockedDates: ReadonlySet<string>;
  updatePreferenceDate: (rank: number, date: string) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      {calendarDays.map((date) => {
        const availability = getAvailability(state, date, blockedDates);
        const rank = preferences.find((preference) => preference.date === date)
          ?.rank;

        return (
          <DayButton
            key={date}
            date={date}
            rank={rank}
            tone={getAvailabilityTone(availability)}
            booked={availability.booked}
            proposed={availability.proposed}
            available={availability.available}
            blocked={availability.blocked}
            onPick={(targetRank) => updatePreferenceDate(targetRank, date)}
          />
        );
      })}
    </div>
  );
}

function AvailabilityList({
  calendarDays,
  preferences,
  state,
  blockedDates,
  updatePreferenceDate,
}: {
  calendarDays: string[];
  preferences: Preference[];
  state: AppState;
  blockedDates: ReadonlySet<string>;
  updatePreferenceDate: (rank: number, date: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-2">
      {calendarDays.map((date) => {
        const availability = getAvailability(state, date, blockedDates);
        const rank = preferences.find((preference) => preference.date === date)
          ?.rank;

        return (
          <div
            key={date}
            className="grid gap-3 rounded-md border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-stone-900 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div>
              <p className="font-semibold text-black dark:text-white">{formatDay(date)}</p>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {availability.blocked
                  ? "Unavailable"
                  : `${availability.booked} booked, ${availability.proposed} proposed, ${availability.available} open`}
              </p>
            </div>
            <RankButtons
              activeRank={rank}
              disabled={availability.available === 0 || availability.blocked}
              onPick={(targetRank) => updatePreferenceDate(targetRank, date)}
            />
          </div>
        );
      })}
    </div>
  );
}

function DayButton({
  available,
  booked,
  date,
  onPick,
  proposed,
  rank,
  tone,
  blocked,
}: {
  available: number;
  booked: number;
  date: string;
  onPick: (rank: number) => void;
  proposed: number;
  rank?: number;
  tone: "open" | "busy" | "full" | "blocked";
  blocked: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-white p-2 transition dark:bg-stone-900",
        tone === "open" && "border-black/10 dark:border-white/10",
        tone === "busy" && "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
        tone === "full" && "border-red-200 bg-red-50 opacity-80 dark:border-red-500/30 dark:bg-red-500/10",
        tone === "blocked" &&
          "border-stone-200 bg-stone-100 opacity-70 dark:border-white/5 dark:bg-stone-800",
        rank ? "ring-2 ring-black dark:ring-white" : false,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-black dark:text-white">
            {formatDay(date)}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {blocked ? "Unavailable" : `${available} open slots`}
          </p>
        </div>
        {rank ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-semibold text-white dark:bg-white dark:text-black">
            {rank}
          </span>
        ) : null}
      </div>

      {blocked ? (
        <p className="mt-3 rounded bg-white/60 px-2 py-1 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-stone-500 dark:bg-stone-900/60 dark:text-stone-400">
          Closed
        </p>
      ) : (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
            <div
              className={cn(
                "h-full rounded-full",
                tone === "open" && "bg-emerald-500",
                tone === "busy" && "bg-amber-500",
                tone === "full" && "bg-red-500",
              )}
              style={{
                width: `${Math.min(((booked + proposed) / 7) * 100, 100)}%`,
              }}
            />
          </div>

          <RankButtons activeRank={rank} disabled={available === 0} onPick={onPick} />
        </>
      )}
    </div>
  );
}

function RankButtons({
  activeRank,
  disabled,
  onPick,
}: {
  activeRank?: number;
  disabled: boolean;
  onPick: (rank: number) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1">
      {[1, 2, 3].map((rank) => (
        <button
          key={rank}
          type="button"
          disabled={disabled}
          onClick={() => onPick(rank)}
          className={cn(
            "min-h-8 rounded-md border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
            activeRank === rank
              ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
              : "border-black/10 bg-white text-stone-700 hover:border-black dark:border-white/15 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-white",
          )}
        >
          #{rank}
        </button>
      ))}
    </div>
  );
}

export function WindowSelect({
  preference,
  updatePreferenceWindow,
}: {
  preference: Preference;
  updatePreferenceWindow: (rank: number, window: DayWindow) => void;
}) {
  return (
    <select
      value={preference.window}
      onChange={(event) =>
        updatePreferenceWindow(preference.rank, event.target.value as DayWindow)
      }
      className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
    >
      {(["Morning", "Midday", "Afternoon", "Evening"] as DayWindow[]).map(
        (window) => (
          <option key={window} value={window}>
            {window}
          </option>
        ),
      )}
    </select>
  );
}
