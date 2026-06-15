"use client";

import { useMemo, useState, useTransition } from "react";

import { proposeTimeFromAdminAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Feedback } from "@/components/shared/feedback";
import { StatusPill } from "@/components/shared/status-pill";
import {
  addDays,
  formatDay,
  hoursInWindow,
  serviceById,
  windowForTime,
  workingHours,
} from "@/domain/schedule";
import type {
  ActionResult,
  Appointment,
  BookingRequest,
  ClientProfile,
  DayWindow,
  Proposal,
  RequestStatus,
  Service,
} from "@/domain/types";
import { cn } from "@/lib/classnames";

const statusMeta: Record<
  RequestStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  pending: { label: "New request", tone: "warning" },
  proposed: { label: "Awaiting client", tone: "info" },
  confirmed: { label: "Confirmed", tone: "success" },
  declined: { label: "Declined — re-propose", tone: "danger" },
};

export function ProposalComposer({
  appointments,
  client,
  request,
  services,
  activeProposal,
}: {
  appointments: Appointment[];
  client?: ClientProfile;
  request: BookingRequest;
  services: Service[];
  activeProposal?: Proposal;
}) {
  const service = serviceById(request.serviceId, services);
  const meta = statusMeta[request.status];
  const canPropose = request.status === "pending" || request.status === "declined";

  const [open, setOpen] = useState(request.status === "pending");
  const initialDate = request.preferences[0]?.date ?? addDays(1);
  const [date, setDate] = useState(initialDate);
  const [windowFilter, setWindowFilter] = useState<DayWindow | "all">(
    request.preferences[0]?.window ?? "all",
  );
  const [time, setTime] = useState(() => firstFreeTime(initialDate));
  const [note, setNote] = useState("Please confirm if this time works for you.");
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
              {client?.name ?? "Unknown client"}
            </p>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>
          <p className="mt-0.5 truncate text-sm text-stone-500 dark:text-stone-400">
            {service.name} · {service.duration} min
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
            Booked for {formatDay(activeProposal.date)} at {activeProposal.time}.
          </p>
        </div>
      ) : null}

      {/* Proposed summary */}
      {request.status === "proposed" && activeProposal ? (
        <div className="border-t border-black/5 px-4 py-3 dark:border-white/5">
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 dark:bg-sky-500/10 dark:text-sky-300">
            Proposed {formatDay(activeProposal.date)} at {activeProposal.time} — waiting for
            the client to confirm.
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
            Client preferences
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
                    Choice {preference.rank}
                  </span>
                  <span className="block font-semibold">{formatDay(preference.date)}</span>
                  <span className="block text-xs opacity-80">{preference.window}</span>
                </button>
              );
            })}
          </div>

          {canPropose ? (
            <>
              {/* Date + window controls */}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    Date
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
                    Time of day
                  </span>
                  <select
                    value={windowFilter}
                    onChange={(event) =>
                      setWindowFilter(event.target.value as DayWindow | "all")
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-black/10 px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
                  >
                    <option value="all">All hours</option>
                    <option value="Morning">Morning</option>
                    <option value="Midday">Midday</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                  </select>
                </label>
              </div>

              {/* Time slot grid */}
              <div className="mt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Pick a slot
                </span>
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                  {slots.map(({ hour, taken }) => {
                    const selected = hour === time;
                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={taken}
                        onClick={() => setTime(hour)}
                        title={taken ? "Already booked" : windowForTime(hour)}
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
              </div>

              {/* Note */}
              <label className="mt-3 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Message to client
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
                  That slot is already booked. Pick another.
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
                  ? "Sending…"
                  : request.status === "declined"
                    ? `Re-propose ${formatDay(date)} at ${time}`
                    : `Propose ${formatDay(date)} at ${time}`}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
