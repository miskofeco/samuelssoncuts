"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { MonthCalendar } from "@/components/shared/month-calendar";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { StatusPill } from "@/components/shared/status-pill";
import { addDays, formatDay, serviceById, todayIso } from "@/domain/schedule";

import { AddBookingModal } from "./add-booking-modal";
import { AppointmentDetailModal } from "./appointment-detail-modal";
import type {
  Appointment,
  BookingRequest,
  ClientProfile,
  Proposal,
  Service,
} from "@/domain/types";
import { cn } from "@/lib/classnames";

export type CalendarItem = {
  id: string;
  title: string;
  service: string;
  servicePrice: number;
  time: string;
  date: string;
  durationMinutes: number;
  type: "Confirmed" | "Proposed";
  // Identifiers for actions (reschedule / cancel).
  appointmentId?: string;
  proposalId?: string;
  requestId?: string | null;
  clientId?: string | null;
  clientEmail?: string;
  clientPhone?: string;
  note?: string;
};

export function AdminCalendar({
  appointments,
  proposals,
  requests,
  clients,
  services,
  blockedDates,
}: {
  appointments: Appointment[];
  proposals: Proposal[];
  requests: BookingRequest[];
  clients: ClientProfile[];
  services: Service[];
  blockedDates: Set<string>;
}) {
  const [view, setView] = useState<"week" | "month">("week");
  const [draft, setDraft] = useState<{ date?: string; time?: string } | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);

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
        title: client?.name ?? appointment.clientName ?? "Client",
        service: service.name,
        servicePrice: service.price,
        time: appointment.time,
        date: appointment.date,
        durationMinutes: service.duration,
        type: "Confirmed",
        appointmentId: appointment.id,
        requestId: appointment.requestId,
        clientId: appointment.clientId,
        clientEmail: client?.email,
        clientPhone: client?.phone,
      });
    }
    for (const proposal of proposals) {
      if (proposal.status !== "sent") continue;
      const request = requests.find((r) => r.id === proposal.requestId);
      const client = clients.find((c) => c.id === request?.clientId);
      const service = request ? serviceById(request.serviceId, services) : undefined;
      push(proposal.date, {
        id: proposal.id,
        title: client?.name ?? "Client",
        service: service?.name ?? "Proposal",
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
        note: proposal.note,
      });
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [appointments, proposals, requests, clients, services]);

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow="Planner"
        title="Schedule"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="success">Confirmed</StatusPill>
            <StatusPill tone="info">Proposed</StatusPill>
            <Button type="button" onClick={() => setDraft({})} className="gap-1.5">
              <span aria-hidden className="text-base leading-none">+</span>
              Add booking
            </Button>
          </div>
        }
      />

      <div className="mt-4 max-w-xs">
        <SegmentedControl
          ariaLabel="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
          ]}
        />
      </div>

      {view === "week" ? (
        <WeekGrid
          itemsByDate={itemsByDate}
          onAddSlot={(date, time) => setDraft({ date, time })}
          onSelect={setSelected}
        />
      ) : (
        <div className="mt-5">
          <MonthCalendar
            renderDay={(cell) => {
              const items = itemsByDate.get(cell.date) ?? [];
              const blocked = blockedDates.has(cell.date);
              if (blocked) {
                return (
                  <span className="mt-1 block rounded bg-stone-200 px-1 py-0.5 text-center text-[0.6rem] font-semibold uppercase text-stone-500 dark:bg-stone-700 dark:text-stone-300">
                    Off
                  </span>
                );
              }
              if (items.length === 0) return null;
              return (
                <span className="mt-1 flex flex-col gap-0.5">
                  {items.slice(0, 2).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[0.6rem] font-semibold",
                        item.type === "Confirmed"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300",
                      )}
                    >
                      {item.time} {item.title}
                    </span>
                  ))}
                  {items.length > 2 ? (
                    <span className="text-[0.6rem] text-stone-400">+{items.length - 2} more</span>
                  ) : null}
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
      />

      <AppointmentDetailModal item={selected} onClose={() => setSelected(null)} />
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
  itemsByDate,
  onAddSlot,
  onSelect,
}: {
  itemsByDate: Map<string, CalendarItem[]>;
  onAddSlot: (date: string, time: string) => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, index) => addDays(index));
  const hours = Array.from({ length: GRID_HOURS }, (_, index) => START_HOUR + index);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Center the current time in the scroll viewport on first open.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(nowOffsetPx() - VIEWPORT_HEIGHT / 2, 0);
  }, []);

  return (
    <>
      {/* Desktop time grid */}
      <div className="mt-5 hidden overflow-x-auto lg:block">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-px rounded-t-xl bg-black/5 dark:bg-white/10">
            <div className="bg-white dark:bg-stone-900" />
            {days.map((day) => {
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={cn(
                    "px-2 py-3 text-center",
                    isToday
                      ? "bg-stone-900 text-white dark:bg-white dark:text-black"
                      : "bg-white dark:bg-stone-900",
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isToday ? "" : "text-black dark:text-white",
                    )}
                  >
                    {formatDay(day)}
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
                  day={day}
                  items={itemsByDate.get(day) ?? []}
                  isToday={day === today}
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
      <div className="mt-5 grid gap-3 lg:hidden">
        {days.map((day) => {
          const items = itemsByDate.get(day) ?? [];
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cn(
                "rounded-xl border bg-white p-3 dark:bg-stone-900",
                isToday ? "border-stone-900 dark:border-white" : "border-black/10 dark:border-white/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-black dark:text-white">{formatDay(day)}</h3>
                <div className="flex items-center gap-2">
                  {isToday ? <StatusPill tone="neutral">Today</StatusPill> : null}
                  <button
                    type="button"
                    onClick={() => onAddSlot(day, "09:00")}
                    className="flex h-8 items-center gap-1 rounded-lg border border-black/10 px-2.5 text-xs font-semibold text-stone-600 transition hover:border-black hover:text-black dark:border-white/15 dark:text-stone-300 dark:hover:border-white dark:hover:text-white"
                  >
                    <span aria-hidden className="text-sm leading-none">+</span>
                    Add
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
                    No appointments.
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

function DayColumn({
  day,
  items,
  isToday,
  onAddSlot,
  onSelect,
}: {
  day: string;
  items: CalendarItem[];
  isToday: boolean;
  onAddSlot: (date: string, time: string) => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const hours = Array.from({ length: GRID_HOURS }, (_, index) => START_HOUR + index);

  return (
    <div
      className={cn(
        "relative",
        isToday ? "bg-stone-50 dark:bg-stone-800/50" : "bg-white dark:bg-stone-900",
      )}
      style={{ height: GRID_HOURS * HOUR_HEIGHT }}
    >
      {/* Hour cells — background gridlines + click-to-add target */}
      {hours.map((hour) => (
        <button
          key={hour}
          type="button"
          onClick={() => onAddSlot(day, `${String(hour).padStart(2, "0")}:00`)}
          title={`Add a booking on ${formatDay(day)} at ${String(hour).padStart(2, "0")}:00`}
          style={{ height: HOUR_HEIGHT }}
          className="group block w-full border-t border-black/5 transition first:border-t-0 hover:bg-stone-100/70 dark:border-white/5 dark:hover:bg-stone-800"
        >
          <span className="flex h-full items-center justify-center text-lg text-stone-300 opacity-0 transition group-hover:opacity-100 dark:text-stone-600">
            +
          </span>
        </button>
      ))}

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
          "absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-lg border-l-2 px-1.5 py-0.5 text-left text-[0.6rem] leading-[1.15] transition hover:brightness-95",
          item.type === "Confirmed"
            ? "border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100"
            : "border-sky-500 bg-sky-100 text-sky-950 dark:bg-sky-500/20 dark:text-sky-100",
        )}
      >
        <span className="truncate font-semibold tabular-nums">
          {item.time}–{endTime}
        </span>
        {showName ? <span className="truncate font-medium">{item.title}</span> : null}
        {showService ? <span className="truncate opacity-70">{item.service}</span> : null}
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
        "block w-full rounded-lg border-l-2 px-3 py-2 text-left text-sm transition hover:brightness-95",
        item.type === "Confirmed"
          ? "border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100"
          : "border-sky-500 bg-sky-100 text-sky-950 dark:bg-sky-500/20 dark:text-sky-100",
      )}
    >
      <p className="font-semibold tabular-nums">
        {item.time}–{endTime} · {item.title}
      </p>
      <p className="truncate opacity-80">{item.service}</p>
    </button>
  );
}
