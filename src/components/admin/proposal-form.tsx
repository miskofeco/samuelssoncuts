"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { proposeTimeFromAdminAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Feedback } from "@/components/shared/feedback";
import { StatusPill } from "@/components/shared/status-pill";
import {
  addDays,
  dayCapacity,
  formatDay,
  formatMonth,
  hoursInWindow,
  monthGrid,
  monthKey,
  serviceById,
  shiftMonth,
  todayIso,
  windowForTime,
  workingHours,
} from "@/domain/schedule";
import type {
  ActionResult,
  Appointment,
  BookingRequest,
  ClientProfile,
  DayWindow,
  Preference,
  Proposal,
  RequestStatus,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionaries";
import { cn } from "@/lib/classnames";

const statusTone: Record<
  RequestStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  pending: "warning",
  proposed: "info",
  confirmed: "success",
  declined: "danger",
};

function statusLabel(t: Dict, status: RequestStatus) {
  switch (status) {
    case "pending":
      return t.admin.statusNewRequest;
    case "proposed":
      return t.admin.statusAwaitingClient;
    case "confirmed":
      return t.admin.statusConfirmed;
    case "declined":
      return t.admin.statusDeclined;
  }
}

export function ProposalComposer({
  appointments,
  client,
  request,
  services,
  activeProposal,
  blockedDates,
}: {
  appointments: Appointment[];
  client?: ClientProfile;
  request: BookingRequest;
  services: Service[];
  activeProposal?: Proposal;
  blockedDates: ReadonlySet<string>;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const service = serviceById(request.serviceId, services);
  const tone = statusTone[request.status];
  const label = statusLabel(t, request.status);
  const canPropose = request.status === "pending" || request.status === "declined";

  const [open, setOpen] = useState(request.status === "pending");
  const initialDate = request.preferences[0]?.date ?? addDays(1);
  const [date, setDate] = useState(initialDate);
  const [windowFilter, setWindowFilter] = useState<DayWindow | "all">(
    request.preferences[0]?.window ?? "all",
  );
  const [time, setTime] = useState(() => firstFreeTime(initialDate));
  const [note, setNote] = useState(t.admin.defaultProposalNote);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  function takenAt(targetDate: string, targetTime: string) {
    return appointments.some(
      (appointment) =>
        appointment.date === targetDate && appointment.time === targetTime,
    );
  }

  function firstFreeTime(targetDate: string) {
    return workingHours.find((hour) => !takenAt(targetDate, hour)) ?? workingHours[0];
  }

  const slots = useMemo(() => {
    const base = windowFilter === "all" ? workingHours : hoursInWindow(windowFilter);
    return base.map((hour) => ({
      hour,
      taken: takenAt(date, hour),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, windowFilter, appointments]);

  function chooseDate(targetDate: string) {
    setDate(targetDate);
    const free = firstFreeTime(targetDate);
    setTime(free);
    setWindowFilter("all");
  }

  function choosePreference(preferenceDate: string, preferenceWindow: DayWindow) {
    setDate(preferenceDate);
    setWindowFilter(preferenceWindow);
    const candidates = hoursInWindow(preferenceWindow).filter(
      (hour) => !takenAt(preferenceDate, hour),
    );
    setTime(candidates[0] ?? firstFreeTime(preferenceDate));
  }

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const result = await proposeTimeFromAdminAction(request.id, date, time, note);
      setFeedback(result);
      if (result.ok) setOpen(false);
    });
  }

  const conflict = takenAt(date, time);

  return (
    <article
      className={cn(
        "rounded-xl border bg-white transition dark:bg-stone-900",
        request.status === "pending"
          ? "border-amber-200 dark:border-amber-500/30"
          : "border-black/10 dark:border-white/10",
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-black dark:text-white">
              {client?.name ?? t.admin.clientFallback}
            </p>
            <StatusPill tone={tone}>{label}</StatusPill>
          </div>
          <p className="mt-0.5 truncate text-sm text-stone-500 dark:text-stone-400">
            {service.name} · {service.duration} {t.admin.minutesShort}
            {client?.email ? ` · ${client.email}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "mt-1 shrink-0 text-stone-400 transition-transform",
            open ? "rotate-180" : "",
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {/* Confirmed summary */}
      {request.status === "confirmed" && activeProposal ? (
        <div className="border-t border-black/5 px-4 py-3 dark:border-white/5">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300">
            {t.admin.bookedConfirmed(formatDay(activeProposal.date, locale), activeProposal.time)}
          </p>
        </div>
      ) : null}

      {/* Proposed summary */}
      {request.status === "proposed" && activeProposal ? (
        <div className="border-t border-black/5 px-4 py-3 dark:border-white/5">
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 dark:bg-sky-500/10 dark:text-sky-300">
            {t.admin.proposedWaiting(formatDay(activeProposal.date, locale), activeProposal.time)}
          </p>
        </div>
      ) : null}

      {open ? (
        <div className="border-t border-black/5 px-4 pb-4 pt-3 dark:border-white/5">
          {/* Client preferences */}
          {request.note ? (
            <p className="mb-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/60 dark:text-stone-300">
              “{request.note}”
            </p>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {t.admin.clientPreferences}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {request.preferences.map((preference) => {
              const active = preference.date === date && windowFilter === preference.window;
              return (
                <button
                  key={preference.id}
                  type="button"
                  onClick={() => choosePreference(preference.date, preference.window)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition",
                    active
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-black/10 bg-white text-stone-700 hover:border-black dark:border-white/15 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-white",
                  )}
                >
                  <span className="block text-xs font-semibold opacity-70">
                    {t.client.choice(preference.rank)}
                  </span>
                  <span className="block font-semibold">{formatDay(preference.date, locale)}</span>
                  <span className="block text-xs opacity-80">{t.windows[preference.window]}</span>
                </button>
              );
            })}
          </div>

          {canPropose ? (
            <>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
                {/* Availability calendar */}
                <AvailabilityCalendar
                  t={t}
                  locale={locale}
                  appointments={appointments}
                  blockedDates={blockedDates}
                  preferences={request.preferences}
                  selectedDate={date}
                  onPickDate={chooseDate}
                />

                {/* Date + window + slot controls */}
                <div>
              {/* Date + window controls */}
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {t.admin.date}
                  </span>
                  <input
                    type="date"
                    value={date}
                    min={addDays(0)}
                    onChange={(event) => chooseDate(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-lg border border-black/10 px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {t.admin.timeOfDay}
                  </span>
                  <select
                    value={windowFilter}
                    onChange={(event) =>
                      setWindowFilter(event.target.value as DayWindow | "all")
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-black/10 px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
                  >
                    <option value="all">{t.admin.allHours}</option>
                    <option value="Morning">{t.windows.Morning}</option>
                    <option value="Midday">{t.windows.Midday}</option>
                    <option value="Afternoon">{t.windows.Afternoon}</option>
                    <option value="Evening">{t.windows.Evening}</option>
                  </select>
                </label>
              </div>

              {/* Time slot grid */}
              <div className="mt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {t.admin.pickSlot}
                </span>
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {slots.map(({ hour, taken }) => {
                    const selected = hour === time;
                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={taken}
                        onClick={() => setTime(hour)}
                        title={taken ? t.admin.alreadyBooked : t.windows[windowForTime(hour)]}
                        className={cn(
                          "h-10 rounded-lg border text-sm font-semibold tabular-nums transition",
                          taken &&
                            "cursor-not-allowed border-black/5 bg-stone-100 text-stone-300 line-through dark:border-white/5 dark:bg-stone-800 dark:text-stone-600",
                          !taken &&
                            selected &&
                            "border-black bg-black text-white shadow-sm dark:border-white dark:bg-white dark:text-black",
                          !taken &&
                            !selected &&
                            "border-black/10 bg-white text-stone-700 hover:border-black dark:border-white/15 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-white",
                        )}
                      >
                        {hour}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-stone-400 dark:text-stone-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded border border-black/10 bg-white dark:border-white/15 dark:bg-stone-900" />
                    {t.admin.legendOpen}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded border border-black/5 bg-stone-100 dark:bg-stone-800" />
                    {t.admin.legendBooked}
                  </span>
                </div>
              </div>
                </div>
              </div>

              {/* Note */}
              <label className="mt-3 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {t.admin.messageToClient}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
                />
              </label>

              {conflict ? (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
                  {t.admin.slotTakenShort}
                </p>
              ) : null}
              <Feedback result={feedback && !feedback.ok ? feedback : null} className="mt-2" />

              <Button
                type="button"
                onClick={submit}
                disabled={conflict || pending}
                className="mt-3 w-full"
              >
                {pending
                  ? t.common.sending
                  : request.status === "declined"
                    ? t.admin.reproposeAt(formatDay(date, locale), time)
                    : t.admin.proposeAt(formatDay(date, locale), time)}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function AvailabilityCalendar({
  t,
  locale,
  appointments,
  blockedDates,
  preferences,
  selectedDate,
  onPickDate,
}: {
  t: Dict;
  locale: string;
  appointments: Appointment[];
  blockedDates: ReadonlySet<string>;
  preferences: Preference[];
  selectedDate: string;
  onPickDate: (date: string) => void;
}) {
  const today = todayIso();
  const [month, setMonth] = useState(() => monthKey(selectedDate || today));
  const cells = monthGrid(month);

  const bookedByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appointment of appointments) {
      counts.set(appointment.date, (counts.get(appointment.date) ?? 0) + 1);
    }
    return counts;
  }, [appointments]);

  const preferenceRank = new Map(preferences.map((p) => [p.date, p.rank]));

  return (
    <div className="rounded-xl border border-black/10 bg-stone-50 p-3 dark:border-white/10 dark:bg-stone-800/40">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-black dark:text-white">{formatMonth(`${month}-01`, locale)}</h4>
        <div className="flex items-center gap-1">
          <CalNav label={t.common.previousMonth} onClick={() => setMonth(shiftMonth(month, -1))}>
            <path d="M15 18l-6-6 6-6" />
          </CalNav>
          <CalNav label={t.common.nextMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
            <path d="M9 18l6-6-6-6" />
          </CalNav>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {t.weekdaysMini.map((day) => (
          <div
            key={day}
            className="pb-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500"
          >
            {day}
          </div>
        ))}

        {cells.map((cell) => {
          const dayNumber = Number(cell.date.slice(8, 10));

          if (!cell.inMonth) {
            return <div key={cell.date} aria-hidden className="h-9" />;
          }

          const isPast = cell.date < today;
          const blocked = blockedDates.has(cell.date);
          const booked = bookedByDate.get(cell.date) ?? 0;
          const full = booked >= dayCapacity;
          const rank = preferenceRank.get(cell.date);
          const selected = cell.date === selectedDate;
          const disabled = isPast || blocked;
          const load = Math.min(booked / dayCapacity, 1);

          return (
            <button
              key={cell.date}
              type="button"
              disabled={disabled}
              onClick={() => onPickDate(cell.date)}
              title={
                blocked
                  ? t.admin.off
                  : `${t.admin.bookedOfCapacity(booked, dayCapacity)}${rank ? ` · ${t.admin.clientChoiceN(rank)}` : ""}`
              }
              className={cn(
                "relative flex h-9 flex-col items-center justify-center rounded-lg border text-xs tabular-nums transition",
                selected
                  ? "border-black bg-black font-semibold text-white dark:border-white dark:bg-white dark:text-black"
                  : disabled
                    ? "cursor-not-allowed border-transparent text-stone-300 dark:text-stone-600"
                    : "border-black/10 text-stone-700 hover:border-black dark:border-white/10 dark:text-stone-200 dark:hover:border-white",
                !selected && !disabled && full && "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10",
                rank !== undefined && !selected && "ring-1 ring-inset ring-black/40 dark:ring-white/40",
              )}
            >
              <span>{dayNumber}</span>
              {/* Booking-load bar */}
              {!disabled && !selected ? (
                <span className="absolute inset-x-1.5 bottom-1 h-0.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      full ? "bg-red-500" : load > 0.6 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.max(load * 100, booked > 0 ? 12 : 0)}%` }}
                  />
                </span>
              ) : null}
              {rank ? (
                <span
                  className={cn(
                    "absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.55rem] font-bold ring-1",
                    selected
                      ? "bg-white text-black ring-black dark:bg-stone-900 dark:text-white dark:ring-white"
                      : "bg-black text-white ring-white dark:bg-white dark:text-black dark:ring-stone-900",
                  )}
                >
                  {rank}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-stone-500 dark:text-stone-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-emerald-500" />
          {t.admin.legendOpen}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-amber-500" />
          {t.admin.legendFilling}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-red-500" />
          {t.admin.legendFull}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-black text-[0.5rem] font-bold text-white dark:bg-white dark:text-black">
            #
          </span>
          {t.admin.legendClientPick}
        </span>
      </div>
    </div>
  );
}

function CalNav({
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
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-stone-600 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-stone-800"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
