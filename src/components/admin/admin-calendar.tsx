"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { MonthCalendar } from "@/components/shared/month-calendar";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { StatusPill } from "@/components/shared/status-pill";
import {
  CLOSE_MINUTES,
  formatDay,
  formatFullDay,
  minutesOf,
  OPEN_MINUTES,
  serviceById,
  shiftWeek,
  timeOfMinutes,
  todayIso,
  weekLabel,
  weekStart,
} from "@/domain/schedule";

import { CalendarExport } from "@/components/shared/calendar-export";

import { AddBookingModal } from "./add-booking-modal";
import { AppointmentDetailModal } from "./appointment-detail-modal";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Proposal,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import type { Dict } from "@/i18n/dictionaries";
import { useLang, useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

export type CalendarItem = {
  id: string;
  title: string;
  service: string;
  servicePrice: number;
  time: string;
  date: string;
  durationMinutes: number;
  type: "Confirmed" | "Barber" | "Proposed";
  // Identifiers for actions (reschedule / cancel).
  appointmentId?: string;
  proposalId?: string;
  requestId?: string | null;
  clientId?: string | null;
  clientEmail?: string;
  clientPhone?: string;
  clientAvatarUrl?: string | null;
  note?: string;
  outcome?: "completed" | "no_show" | "cancelled" | null;
};

// Slim slot record threaded into the booking/reschedule modals so their time
// pickers can grey out times that overlap an existing booking. `id` lets the
// reschedule picker exclude the appointment being moved.
export type BookedSlot = {
  id: string;
  time: string;
  durationMinutes: number;
};

export function AdminCalendar({
  appointments,
  proposals,
  requests,
  clients,
  services,
  blockedDates,
  feedUrl,
}: {
  appointments: Appointment[];
  proposals: Proposal[];
  requests: BookingRequest[];
  clients: ClientProfile[];
  services: Service[];
  blockedDates: Set<string>;
  feedUrl?: string;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [weekMonday, setWeekMonday] = useState<string>(() => weekStart(todayIso()));
  const [dayDate, setDayDate] = useState<string>(() => todayIso());
  const [draft, setDraft] = useState<{ date?: string; time?: string } | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const today = todayIso();

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const push = (date: string, item: CalendarItem) => {
      const list = map.get(date) ?? [];
      list.push(item);
      map.set(date, list);
    };

    for (const appointment of appointments) {
      const service = serviceById(appointment.serviceId, services);
      const client = clients.find((c) => c.id === appointment.clientId);
      push(appointment.date, {
        id: appointment.id,
        title: client?.name ?? appointment.clientName ?? t.admin.clientFallback,
        service: service.name,
        servicePrice: service.price,
        time: appointment.time,
        date: appointment.date,
        durationMinutes: service.duration,
        type: appointment.requestId ? "Confirmed" : "Barber",
        appointmentId: appointment.id,
        requestId: appointment.requestId,
        clientId: appointment.clientId,
        clientEmail: client?.email,
        clientPhone: client?.phone,
        clientAvatarUrl: client?.avatarUrl,
        outcome: appointment.outcome,
      });
    }
    for (const proposal of proposals) {
      if (proposal.status !== "sent") continue;
      const request = requests.find((r) => r.id === proposal.requestId);
      const client = clients.find((c) => c.id === request?.clientId);
      const service = request ? serviceById(request.serviceId, services) : undefined;
      push(proposal.date, {
        id: proposal.id,
        title: client?.name ?? t.admin.clientFallback,
        service: service?.name ?? t.admin.proposalFallback,
        servicePrice: service?.price ?? 0,
        time: proposal.time,
        date: proposal.date,
        durationMinutes: service?.duration ?? 30,
        type: "Proposed",
        proposalId: proposal.id,
        requestId: proposal.requestId,
        clientId: request?.clientId ?? null,
        clientEmail: client?.email,
        clientPhone: client?.phone,
        clientAvatarUrl: client?.avatarUrl,
        note: proposal.note,
      });
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [appointments, proposals, requests, clients, services, t]);

  // Confirmed bookings per date (proposals don't block — they're concurrent
  // until confirmed), threaded into the modals to disable overlapping slots.
  const bookedByDate = useMemo(() => {
    const map = new Map<string, BookedSlot[]>();
    for (const [date, list] of itemsByDate) {
      const slots = list
        .filter((item) => item.type !== "Proposed")
        .map((item) => ({ id: item.id, time: item.time, durationMinutes: item.durationMinutes }));
      if (slots.length > 0) map.set(date, slots);
    }
    return map;
  }, [itemsByDate]);

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow={t.admin.calendarEyebrow}
        title={t.admin.schedule}
        action={
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                {t.admin.confirmed}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                {t.admin.addBooking}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                {t.statuses.proposedShort}
              </span>
            </div>
            <CalendarExport feedUrl={feedUrl} />
            <Button type="button" onClick={() => setDraft({})} className="gap-1.5">
              <span aria-hidden className="text-base leading-none">+</span>
              {t.admin.addBooking}
            </Button>
          </div>
        }
      />

      <div className="mt-4 max-w-xs">
        <SegmentedControl
          ariaLabel={t.admin.calendarView}
          value={view}
          onChange={setView}
          options={[
            { label: t.admin.day, value: "day" },
            { label: t.admin.week, value: "week" },
            { label: t.admin.month, value: "month" },
          ]}
        />
      </div>

      {view === "day" ? (
        <DayAgenda
          t={t}
          locale={locale}
          date={dayDate}
          onDateChange={setDayDate}
          items={itemsByDate.get(dayDate) ?? []}
          blocked={blockedDates.has(dayDate)}
          onAddSlot={(date, time) => setDraft({ date, time })}
          onSelect={setSelected}
        />
      ) : view === "week" ? (
        <WeekGrid
          t={t}
          locale={locale}
          weekMonday={weekMonday}
          onWeekChange={setWeekMonday}
          itemsByDate={itemsByDate}
          blockedDates={blockedDates}
          onAddSlot={(date, time) => setDraft({ date, time })}
          onSelect={setSelected}
        />
      ) : (
        <div className="mt-5">
          <MonthCalendar
            onDayClick={(cell) => {
              const items = itemsByDate.get(cell.date) ?? [];
              if (items.length === 0 && !blockedDates.has(cell.date) && cell.date >= today) {
                setDraft({ date: cell.date });
                return;
              }
              // Drill into week view for that day — works for any date (past or future).
              setWeekMonday(weekStart(cell.date));
              setView("week");
            }}
            dayClassName={(cell) => {
              if (cell.date < today) {
                return "cursor-not-allowed border-dashed !border-stone-400 !bg-stone-200 text-stone-500 dark:!border-stone-700 dark:!bg-stone-800 dark:text-stone-500";
              }
              if (blockedDates.has(cell.date)) {
                return "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/15";
              }
              return "";
            }}
            dayNumberClassName={(cell) =>
              cell.date < today
                ? "text-stone-400 dark:text-stone-500"
                : blockedDates.has(cell.date)
                  ? "text-red-900 dark:text-red-100"
                : ""
            }
            renderDay={(cell) => {
              const items = itemsByDate.get(cell.date) ?? [];
              const blocked = blockedDates.has(cell.date);
              if (blocked) {
                return (
                  <span
                    aria-label={t.admin.off}
                    className="mt-1 block h-2 rounded-full bg-red-200 px-0 py-0 text-center text-[0.6rem] font-semibold uppercase sm:h-auto sm:rounded sm:px-1 sm:py-0.5 dark:bg-red-500/30"
                  >
                    <span className="sr-only text-red-700 sm:not-sr-only dark:text-red-300">
                      {t.admin.off}
                    </span>
                  </span>
                );
              }
              if (items.length === 0) return null;
              return (
                <span className="mt-1 flex flex-row flex-wrap gap-1">
                  {items.map((item) => (
                    <span
                      key={item.id}
                      aria-label={`${item.time} ${item.title}`}
                      className={cn(
                        "block h-2 w-2 rounded-full",
                        monthDotToneClasses(item.type),
                      )}
                    >
                      <span className="sr-only">
                        {item.time} {item.title}
                      </span>
                    </span>
                  ))}
                </span>
              );
            }}
          />
        </div>
      )}

      <AddBookingModal
        open={draft !== null}
        onClose={() => setDraft(null)}
        clients={clients}
        services={services}
        initialDate={draft?.date}
        initialTime={draft?.time}
        bookedByDate={bookedByDate}
      />

      <AppointmentDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        bookedByDate={bookedByDate}
      />
    </Card>
  );
}

// Desktop time grid spans the working day. Each hour is HOUR_HEIGHT px tall, so
// a booking's top offset and height map directly to its start time / duration.
const START_HOUR = 7;
const END_HOUR = 21; // exclusive end — 07:00 open, last book 20:00 (runs to ~21:00)
const GRID_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 64;
// Visible height of the scrollable grid body (the full grid is taller and scrolls).
const VIEWPORT_HEIGHT = 9 * HOUR_HEIGHT;

function minutesFromStart(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours - START_HOUR) * 60 + minutes;
}

export function addMinutesToTime(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// "yyyy-mm-dd" shifted by whole days (noon anchor avoids DST edge cases).
function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Single-day agenda: a chronological list of the day's items with prev/next
// navigation. Reuses the same item model and detail modal as the other views.
function DayAgenda({
  t,
  locale,
  date,
  onDateChange,
  items,
  blocked,
  onAddSlot,
  onSelect,
}: {
  t: Dict;
  locale: string;
  date: string;
  onDateChange: (date: string) => void;
  items: CalendarItem[];
  blocked: boolean;
  onAddSlot: (date: string, time?: string) => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const today = todayIso();
  const sorted = [...items].sort((a, b) => (a.time < b.time ? -1 : 1));

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          aria-label={t.admin.prevDay}
          onClick={() => onDateChange(shiftDay(date, -1))}
        >
          ‹
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-black dark:text-white">
            {formatFullDay(date, locale)}
          </p>
          {date !== today ? (
            <button
              type="button"
              onClick={() => onDateChange(today)}
              className="text-xs font-semibold text-stone-500 underline underline-offset-4 hover:text-black dark:text-stone-400 dark:hover:text-white"
            >
              {t.common.today}
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-label={t.admin.nextDay}
          onClick={() => onDateChange(shiftDay(date, 1))}
        >
          ›
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {blocked ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
            {t.admin.off}
          </p>
        ) : null}
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 px-3 py-6 text-center dark:border-white/15">
            <p className="text-sm text-stone-500 dark:text-stone-400">{t.admin.noAppointments}</p>
            {date >= today && !blocked ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => onAddSlot(date)}
              >
                +
              </Button>
            ) : null}
          </div>
        ) : (
          sorted.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                neutralChipClasses,
              )}
            >
              <span className={cn("h-8 w-1 shrink-0 rounded-full", accentToneClasses(item.type))} />
              <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-black dark:text-white">
                {item.time}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-black dark:text-white">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                  {item.service}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// Pixel offset of the current time within the grid (clamped to the visible band).
function nowOffsetPx() {
  const now = new Date();
  const minutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
  const max = GRID_HOURS * 60;
  const clamped = Math.min(Math.max(minutes, 0), max);
  return (clamped / 60) * HOUR_HEIGHT;
}

function CurrentTimeLine() {
  const [offset, setOffset] = useState<number | null>(null);

  // Set on mount and tick each minute (avoids SSR/initial-render time mismatch).
  useEffect(() => {
    const update = () => setOffset(nowOffsetPx());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  if (offset === null) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top: offset }}
      aria-hidden
    >
      {/* Offset by the 64px time gutter so the line crosses only the day columns. */}
      <div className="relative ml-16 border-t border-dashed border-red-500/70">
        <span className="absolute left-0 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
      </div>
    </div>
  );
}

function WeekGrid({
  t,
  locale,
  weekMonday,
  onWeekChange,
  itemsByDate,
  blockedDates,
  onAddSlot,
  onSelect,
}: {
  t: Dict;
  locale: string;
  weekMonday: string;
  onWeekChange: (monday: string) => void;
  itemsByDate: Map<string, CalendarItem[]>;
  blockedDates: Set<string>;
  onAddSlot: (date: string, time: string) => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(`${weekMonday}T12:00:00`);
    d.setDate(d.getDate() + index);
    return d.toISOString().slice(0, 10);
  });
  const hours = Array.from({ length: GRID_HOURS }, (_, index) => START_HOUR + index);
  const isCurrentWeek = weekMonday === weekStart(today);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Center the current time in the scroll viewport on first open.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(nowOffsetPx() - VIEWPORT_HEIGHT / 2, 0);
  }, []);

  return (
    <>
      {/* Week navigation */}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          aria-label={t.common.previousMonth}
          onClick={() => onWeekChange(shiftWeek(weekMonday, -1))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10 text-stone-600 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="min-w-0 flex-1 text-center text-sm font-semibold text-black dark:text-white">
          {weekLabel(weekMonday, locale)}
        </span>
        <button
          type="button"
          aria-label={t.common.nextMonth}
          onClick={() => onWeekChange(shiftWeek(weekMonday, 1))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10 text-stone-600 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        {!isCurrentWeek ? (
          <button
            type="button"
            onClick={() => onWeekChange(weekStart(today))}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            {t.common.today}
          </button>
        ) : null}
      </div>

      {/* Desktop time grid */}
      <div className="mt-3 hidden overflow-x-auto lg:block">
        <div className="min-w-245">
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-px rounded-t-xl bg-black/5 dark:bg-white/10">
            <div className="bg-white dark:bg-stone-900" />
            {days.map((day) => {
              const isToday = day === today;
              const isBlocked = blockedDates.has(day);
              return (
                <div
                  key={day}
                  className={cn(
                    "px-2 py-3 text-center",
                    isBlocked
                      ? "bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-100"
                      : isToday
                        ? "bg-stone-900 text-white dark:bg-white dark:text-black"
                        : "bg-white dark:bg-stone-900",
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isBlocked
                        ? "text-red-900 dark:text-red-100"
                        : isToday
                          ? ""
                          : "text-black dark:text-white",
                    )}
                  >
                    {formatDay(day, locale)}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Scrollable time body */}
          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{ height: VIEWPORT_HEIGHT }}
          >
            <div className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-px bg-black/5 dark:bg-white/10">
              {/* Time gutter */}
              <div className="bg-white dark:bg-stone-900">
                {hours.map((hour) => (
                  <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative">
                    <span className="absolute right-2 top-1 text-xs font-medium text-stone-400 dark:text-stone-500">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => (
                <DayColumn
                  key={day}
                  t={t}
                  locale={locale}
                  day={day}
                  items={itemsByDate.get(day) ?? []}
                  isToday={day === today}
                  isPast={day < today}
                  isBlocked={blockedDates.has(day)}
                  onAddSlot={onAddSlot}
                  onSelect={onSelect}
                />
              ))}

              {/* Current-time dashed indicator across all columns */}
              <CurrentTimeLine />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile day list */}
      <div className="mt-3 grid gap-3 lg:hidden">
        {days.map((day) => {
          const items = itemsByDate.get(day) ?? [];
          const isToday = day === today;
          const isPast = day < today;
          const isBlocked = blockedDates.has(day);
          const canAdd = !isBlocked && !isPast;
          return (
            <div
              key={day}
              className={cn(
                "rounded-xl border bg-white p-3 dark:bg-stone-900",
                isBlocked
                  ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/15"
                  : isToday
                    ? "border-stone-900 dark:border-white"
                    : "border-black/10 dark:border-white/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3
                  className={cn(
                    "font-semibold text-black dark:text-white",
                    isBlocked && "text-red-900 dark:text-red-100",
                  )}
                >
                  {formatDay(day, locale)}
                </h3>
                <div className="flex items-center gap-2">
                  {isBlocked ? <StatusPill tone="danger">{t.admin.off}</StatusPill> : null}
                  {isToday ? <StatusPill tone="neutral">{t.common.today}</StatusPill> : null}
                  {canAdd ? (
                    <button
                      type="button"
                      onClick={() => onAddSlot(day, firstFreeSlot(items, isToday))}
                      className="flex h-8 items-center gap-1 rounded-lg border border-black/10 px-2.5 text-xs font-semibold text-stone-600 transition hover:border-black hover:text-black dark:border-white/15 dark:text-stone-300 dark:hover:border-white dark:hover:text-white"
                    >
                      <span aria-hidden className="text-sm leading-none">+</span>
                      {t.admin.addShort}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                  <p
                    className={cn(
                      "rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500 dark:bg-stone-800/60 dark:text-stone-400",
                      isBlocked &&
                        "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200",
                    )}
                  >
                    {isBlocked ? t.admin.off : t.admin.noAppointments}
                  </p>
                ) : (
                  items.map((item) => (
                    <MobileChip key={item.id} item={item} onSelect={onSelect} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Snap a within-grid pixel offset to the nearest SNAP_MINUTES boundary, returned
// as absolute minutes-of-day. Clamped to the bookable window.
const SNAP_MINUTES = 15;
function snapOffsetToMinutes(offsetY: number, pixelsPerHour = HOUR_HEIGHT) {
  const rawMinutes = (offsetY / pixelsPerHour) * 60 + START_HOUR * 60;
  const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.min(Math.max(snapped, OPEN_MINUTES), CLOSE_MINUTES - SNAP_MINUTES);
}

function snapPointerToMinutes(clientY: number, rect: Pick<DOMRect, "top" | "height">) {
  const renderedHourHeight = rect.height > 0 ? rect.height / GRID_HOURS : HOUR_HEIGHT;
  return snapOffsetToMinutes(clientY - rect.top, renderedHourHeight);
}

// First bookable minute on a day: opening, or "now" rounded up if it's today.
function earliestMinute(isToday: boolean) {
  if (!isToday) return OPEN_MINUTES;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return Math.ceil(Math.max(OPEN_MINUTES, nowMin) / SNAP_MINUTES) * SNAP_MINUTES;
}

// First 15-min slot from `earliest` that doesn't fall inside an existing booking,
// or the earliest slot if the whole day is somehow busy. Used to seed the mobile
// "+ Add" button so it lands on a sensible free time rather than a fixed 09:00.
function firstFreeSlot(items: CalendarItem[], isToday: boolean) {
  const busy = items.map((item) => ({
    start: minutesOf(item.time),
    end: minutesOf(item.time) + item.durationMinutes,
  }));
  const start = earliestMinute(isToday);
  for (let minute = start; minute <= CLOSE_MINUTES - SNAP_MINUTES; minute += SNAP_MINUTES) {
    if (!busy.some((b) => minute >= b.start && minute < b.end)) return timeOfMinutes(minute);
  }
  return timeOfMinutes(Math.min(start, CLOSE_MINUTES - SNAP_MINUTES));
}

function DayColumn({
  t,
  locale,
  day,
  items,
  isToday,
  isPast,
  isBlocked,
  onAddSlot,
  onSelect,
}: {
  t: Dict;
  locale: string;
  day: string;
  items: CalendarItem[];
  isToday: boolean;
  isPast: boolean;
  isBlocked: boolean;
  onAddSlot: (date: string, time: string) => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const hours = Array.from({ length: GRID_HOURS }, (_, index) => START_HOUR + index);

  // Busy intervals (confirmed + barber + proposed) used to block click-to-add
  // landing inside an existing booking. Minutes-of-day half-open [start, end).
  const busy = items.map((item) => ({
    start: minutesOf(item.time),
    end: minutesOf(item.time) + item.durationMinutes,
  }));

  // First bookable minute on `day` — opening, or rounded-up "now" if it's today.
  const earliest = earliestMinute(isToday);

  // Hover affordance: the snapped minute the cursor is over (null when away).
  const [hoverMin, setHoverMin] = useState<number | null>(null);

  function minuteIsBusy(minute: number) {
    return busy.some((b) => minute >= b.start && minute < b.end);
  }

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (isBlocked || isPast) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverMin(snapPointerToMinutes(event.clientY, rect));
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isBlocked || isPast) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minute = snapPointerToMinutes(event.clientY, rect);
    // No-op when the click lands inside an existing booking (the chip's own
    // onClick handles selection) or before the earliest bookable time.
    if (minuteIsBusy(minute) || minute < earliest) return;
    onAddSlot(day, timeOfMinutes(minute));
  }

  const showHoverAdd =
    !isBlocked && !isPast && hoverMin !== null && !minuteIsBusy(hoverMin) && hoverMin >= earliest;

  return (
    <div
      className={cn(
        "relative",
        isBlocked
          ? "bg-red-50 dark:bg-red-500/15"
          : isToday
            ? "bg-stone-50 dark:bg-stone-800/50"
            : "bg-white dark:bg-stone-900",
      )}
      style={{ height: GRID_HOURS * HOUR_HEIGHT }}
    >
      {/* Hour gridlines (non-interactive background) */}
      {hours.map((hour, index) => (
        <div
          key={hour}
          style={{ height: HOUR_HEIGHT }}
          className={cn(
            "border-t",
            index === 0 && "border-t-0",
            isBlocked ? "border-red-200/70 dark:border-red-500/20" : "border-black/5 dark:border-white/5",
          )}
        />
      ))}

      {/* Past-time veil on today's column (above gridlines, below bookings/click) */}
      {isToday && earliest > OPEN_MINUTES && earliest <= CLOSE_MINUTES ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 bg-stone-100/50 dark:bg-black/30"
          style={{ height: ((Math.min(earliest, CLOSE_MINUTES) - OPEN_MINUTES) / 60) * HOUR_HEIGHT }}
        />
      ) : null}

      {/* Click-to-add surface — snaps to the cursor's 15-min slot. Sits beneath
          the booking chips (z-10) so clicks on bookings select rather than add. */}
      {!isBlocked ? (
        isBlocked ? null : (
          <div
            className="absolute inset-0 cursor-pointer"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverMin(null)}
            onClick={handleClick}
            title={
              hoverMin !== null
                ? t.admin.addBookingAt(formatDay(day, locale), timeOfMinutes(hoverMin))
                : undefined
            }
          >
            {showHoverAdd ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-1 flex items-center gap-1 rounded-md border border-dashed border-stone-300 bg-white/70 px-1.5 text-[0.6rem] font-semibold text-stone-500 dark:border-stone-600 dark:bg-stone-800/70 dark:text-stone-300"
                style={{
                  top: ((hoverMin - START_HOUR * 60) / 60) * HOUR_HEIGHT,
                  height: (SNAP_MINUTES / 60) * HOUR_HEIGHT,
                }}
              >
                <span className="text-sm leading-none">+</span>
                {timeOfMinutes(hoverMin)}
              </span>
            ) : null}
          </div>
        )
      ) : null}

      {/* Bookings positioned by start time, sized by duration */}
      {items.map((item) => {
        const top = (minutesFromStart(item.time) / 60) * HOUR_HEIGHT;
        const height = Math.max((item.durationMinutes / 60) * HOUR_HEIGHT, 22);
        return (
          <CalendarChip
            key={item.id}
            item={item}
            style={{ top, height }}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

// Mobile month view shows a tiny color-coded dot — too small for an inset bar,
// so the accent color fills it. Overridden to a neutral surface at sm+.
function monthDotToneClasses(type: CalendarItem["type"]) {
  switch (type) {
    case "Confirmed":
      return "bg-emerald-500 dark:bg-emerald-500";
    case "Barber":
      return "bg-blue-500 dark:bg-blue-500";
    case "Proposed":
      return "bg-orange-500 dark:bg-orange-500";
  }
}

// Neutral event block — grey surface with a subtle border. The event type is
// conveyed only by the inset accent bar (see accentToneClasses), not a full tint.
const neutralChipClasses =
  "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-200 dark:hover:bg-stone-700/60";

// Color of the vertical accent bar, matching the legend for each event type.
function accentToneClasses(type: CalendarItem["type"]) {
  switch (type) {
    case "Confirmed":
      return "bg-emerald-500";
    case "Barber":
      return "bg-blue-500";
    case "Proposed":
      return "bg-orange-500";
  }
}

function CalendarChip({
  item,
  style,
  onSelect,
}: {
  item: CalendarItem;
  style?: React.CSSProperties;
  onSelect: (item: CalendarItem) => void;
}) {
  const endTime = addMinutesToTime(item.time, item.durationMinutes);
  // Add lines as the block gets taller: time → +name → +service.
  const showName = item.durationMinutes >= 30;
  const showService = item.durationMinutes >= 45;

  // Fixed-position tooltip — the chip lives in an overflow-hidden scroller, so a
  // normally-positioned tooltip would be clipped. Anchor it to the chip's rect.
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  function showTip(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ x: rect.left, y: rect.top });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(item)}
        onMouseEnter={showTip}
        onMouseLeave={() => setTip(null)}
        style={style}
        className={cn(
          "absolute inset-x-1 z-10 flex overflow-hidden rounded-md py-0.5 pl-3.5 pr-1.5 text-left leading-tight transition",
          neutralChipClasses,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-1 w-1 rounded-full",
            accentToneClasses(item.type),
          )}
        />
        <span className="flex min-w-0 flex-col gap-px">
          {showName ? (
            <span className="truncate text-xs font-semibold leading-tight">{item.title}</span>
          ) : null}
          <span className="truncate text-[0.65rem] leading-tight tabular-nums opacity-60">
            {item.time}–{endTime}
          </span>
          {showService ? (
            <span className="truncate text-[0.65rem] leading-tight opacity-60">{item.service}</span>
          ) : null}
        </span>
      </button>

      {tip
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 -translate-y-full rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg dark:bg-stone-700"
              style={{ left: tip.x, top: tip.y - 6 }}
            >
              <p className="font-semibold tabular-nums">
                {item.time}–{endTime}
              </p>
              <p>{item.title}</p>
              <p className="opacity-80">{item.service}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MobileChip({
  item,
  onSelect,
}: {
  item: CalendarItem;
  onSelect: (item: CalendarItem) => void;
}) {
  const endTime = addMinutesToTime(item.time, item.durationMinutes);
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        "relative flex w-full rounded-lg py-2 pl-5 pr-3 text-left transition",
        neutralChipClasses,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-2 w-1 rounded-full",
          accentToneClasses(item.type),
        )}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs opacity-60">
          <span className="tabular-nums">
            {item.time}–{endTime}
          </span>
          {" · "}
          {item.service}
        </span>
      </span>
    </button>
  );
}
