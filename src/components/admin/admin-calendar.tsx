"use client";

import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BlockedIcon,
  Calendar03Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/shared/button";
import { CalendarExport } from "@/components/shared/calendar-export";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { DAY_PICKER_LOCALES, ScheduleCalendar } from "@/components/shared/schedule-calendar";
import { isoToLocalDate, localDateToIso } from "@/components/shared/date-field";
import { Icon } from "@/components/shared/icon";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusPill } from "@/components/shared/status-pill";
import { Tooltip } from "@/components/shared/tooltip";
import {
  CLOSE_MINUTES,
  addMinutesToTime,
  formatDay,
  formatFullDay,
  minutesOf,
  monthKey,
  monthLabel,
  OPEN_MINUTES,
  serviceById,
  shiftMonth,
  shiftWeek,
  timeOfMinutes,
  todayIso,
  weekLabel,
  weekStart,
} from "@/domain/schedule";
import { addDaysToDate, nowMinutesInShopTimeZone } from "@/lib/time-zone";

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

const AddBookingModal = dynamic(
  () => import("./add-booking-modal").then((module) => module.AddBookingModal),
  { ssr: false },
);
const AppointmentDetailModal = dynamic(
  () => import("./appointment-detail-modal").then((module) => module.AppointmentDetailModal),
  { ssr: false },
);

export type CalendarItem = {
  id: string;
  title: string;
  service: string;
  servicePrice: number;
  finalPriceCents: number;
  surcharge?: boolean;
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

type CalendarView = "day" | "week" | "month";

const MOBILE_QUERY = "(max-width: 1023px)";

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function mobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

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
  const lang = useLang();
  const locale = localeFor(lang);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const [draft, setDraft] = useState<{ date?: string; time?: string } | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [addOpened, setAddOpened] = useState(false);
  const [detailOpened, setDetailOpened] = useState(false);
  if (draft && !addOpened) setAddOpened(true);
  if (selected && !detailOpened) setDetailOpened(true);
  const today = todayIso();
  const requestedView = searchParams.get("view");
  const view: CalendarView =
    requestedView === "day" || requestedView === "week" || requestedView === "month"
      ? requestedView
      : isMobile
        ? "day"
        : "week";
  const requestedDate = searchParams.get("date");
  const selectedDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : today;
  const weekMonday = weekStart(selectedDate);

  function navigateCalendar(nextView: CalendarView, nextDate = selectedDate, replace = false) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    params.set("date", nextDate);
    const href = `${pathname}?${params.toString()}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  // Canonicalize only when a URL param is present but invalid. Absent params
  // are left alone: the default view depends on `isMobile`, whose server
  // snapshot is desktop, so rewriting on absence would navigate twice on phones.
  const viewInvalid = requestedView !== null && requestedView !== view;
  const dateInvalid = requestedDate !== null && requestedDate !== selectedDate;
  useEffect(() => {
    if (viewInvalid || dateInvalid) {
      navigateCalendar(view, selectedDate, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewInvalid, dateInvalid, selectedDate, view]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const requestsById = new Map(requests.map((request) => [request.id, request]));
    const clientsById = new Map(clients.map((client) => [client.id, client]));
    const push = (date: string, item: CalendarItem) => {
      const list = map.get(date) ?? [];
      list.push(item);
      map.set(date, list);
    };

    for (const appointment of appointments) {
      const service = serviceById(appointment.serviceId, services);
      const client = appointment.clientId ? clientsById.get(appointment.clientId) : undefined;
      const bookedPriceCents = appointment.requestId
        ? requestsById.get(appointment.requestId)?.priceCents ?? Math.round(service.price * 100)
        : Math.round(service.price * 100);
      push(appointment.date, {
        id: appointment.id,
        title: client?.name ?? appointment.clientName ?? t.admin.clientFallback,
        service: service.name,
        servicePrice: service.price,
        finalPriceCents: bookedPriceCents,
        surcharge: appointment.requestId ? requestsById.get(appointment.requestId)?.surcharge : undefined,
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
      const request = requestsById.get(proposal.requestId);
      const client = request?.clientId ? clientsById.get(request.clientId) : undefined;
      const service = request ? serviceById(request.serviceId, services) : undefined;
      const bookedPriceCents = request?.priceCents ?? Math.round((service?.price ?? 0) * 100);
      push(proposal.date, {
        id: proposal.id,
        title: client?.name ?? t.admin.clientFallback,
        service: service?.name ?? t.admin.proposalFallback,
        servicePrice: service?.price ?? 0,
        finalPriceCents: bookedPriceCents,
        surcharge: request?.surcharge,
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

  // Toolbar navigation is shared by all three views: prev / period label /
  // next, plus a "today" shortcut. The label opens a shadcn Calendar popover
  // so the barber can jump straight to any date instead of paging.
  const selectedMonth = monthKey(selectedDate);
  const isOnToday =
    view === "day"
      ? selectedDate === today
      : view === "week"
        ? weekMonday === weekStart(today)
        : selectedMonth === monthKey(today);
  const navLabel =
    view === "day"
      ? formatFullDay(selectedDate, locale)
      : view === "week"
        ? weekLabel(weekMonday, locale)
        : monthLabel(selectedMonth, locale);
  const [jumpOpen, setJumpOpen] = useState(false);
  function step(direction: -1 | 1) {
    if (view === "day") navigateCalendar("day", shiftDay(selectedDate, direction));
    else if (view === "week") navigateCalendar("week", shiftWeek(weekMonday, direction));
    else navigateCalendar("month", `${shiftMonth(selectedMonth, direction)}-01`);
  }
  function jumpToToday() {
    navigateCalendar(view, view === "week" ? weekStart(today) : today);
  }
  function jumpToDate(iso: string) {
    setJumpOpen(false);
    navigateCalendar(view, view === "week" ? weekStart(iso) : iso);
  }
  const stepLabels =
    view === "day"
      ? { prev: t.admin.prevDay, next: t.admin.nextDay }
      : view === "week"
        ? { prev: t.admin.previousWeek, next: t.admin.nextWeek }
        : { prev: t.common.previousMonth, next: t.common.nextMonth };

  return (
    <div className="space-y-4">
      {/* Legend + secondary actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul aria-label={t.admin.legend} className="flex flex-wrap items-center gap-2">
          <LegendItem tone="bg-emerald-500">{t.admin.confirmed}</LegendItem>
          <LegendItem tone="bg-blue-500">{t.admin.addBooking}</LegendItem>
          <LegendItem tone="bg-orange-500">{t.statuses.proposedShort}</LegendItem>
        </ul>
        <div className="flex items-center gap-2">
          <CalendarExport feedUrl={feedUrl} />
          <Button type="button" onClick={() => setDraft({})} className="hidden md:inline-flex">
            <Icon icon={Add01Icon} strokeWidth={2.2} />
            {t.admin.addBooking}
          </Button>
        </div>
      </div>

      {/* Toolbar: sticky under the phone top bar, static from md */}
      <div className="sticky top-[calc(max(0.5rem,env(safe-area-inset-top))+2.75rem+1px)] z-20 -mx-4 bg-background/92 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex flex-col gap-2 rounded-xl bg-card p-2 shadow-xs ring-1 ring-foreground/10 md:flex-row md:items-center md:gap-3">
          <SegmentedControl
            ariaLabel={t.admin.calendarView}
            value={view}
            onChange={(next) => navigateCalendar(next)}
            options={[
              { label: t.admin.day, value: "day" },
              { label: t.admin.week, value: "week" },
              { label: t.admin.month, value: "month" },
            ]}
            className="md:max-w-xs"
          />
          <div className="flex items-center gap-1 md:ml-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={stepLabels.prev}
              onClick={() => step(-1)}
            >
              <Icon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
            <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t.admin.jumpToDate}
                  className="h-10 min-w-0 flex-1 px-2 md:min-w-56"
                >
                  <span className="truncate text-sm font-semibold text-foreground capitalize tabular-nums" aria-live="polite">
                    {navLabel}
                  </span>
                  <Icon icon={Calendar03Icon} className="text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-auto p-0">
                <Calendar
                  mode="single"
                  locale={DAY_PICKER_LOCALES[lang]}
                  weekStartsOn={1}
                  selected={isoToLocalDate(selectedDate)}
                  defaultMonth={isoToLocalDate(selectedDate)}
                  onSelect={(date) => {
                    if (date) jumpToDate(localDateToIso(date));
                  }}
                  className="[--cell-size:--spacing(9)]"
                />
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => jumpToDate(today)}
                  >
                    {t.common.today}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={stepLabels.next}
              onClick={() => step(1)}
            >
              <Icon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
            {!isOnToday ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={jumpToToday}
                className="ml-1 hidden h-10 sm:inline-flex"
              >
                {t.common.today}
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              aria-label={t.admin.addBooking}
              onClick={() => setDraft({})}
              className="ml-1 md:hidden"
            >
              <Icon icon={Add01Icon} strokeWidth={2.2} />
            </Button>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl p-0 sm:p-0">
        {view === "day" ? (
          <DayAgenda
            t={t}
            date={selectedDate}
            items={itemsByDate.get(selectedDate) ?? []}
            blocked={blockedDates.has(selectedDate)}
            onAddSlot={(date, time) => setDraft({ date, time })}
            onSelect={setSelected}
          />
        ) : view === "week" ? (
          <WeekGrid
            t={t}
            locale={locale}
            weekMonday={weekMonday}
            itemsByDate={itemsByDate}
            blockedDates={blockedDates}
            onAddSlot={(date, time) => setDraft({ date, time })}
            onSelect={setSelected}
          />
        ) : (
          <div className="p-3 sm:p-5">
            <ScheduleCalendar
              size="fluid"
              hideNavigation
              month={selectedMonth}
              onMonthChange={(month) => navigateCalendar("month", `${month}-01`)}
              selected={selectedDate}
              onSelect={(iso) => {
                const items = itemsByDate.get(iso) ?? [];
                if (items.length === 0 && !blockedDates.has(iso) && iso >= today) {
                  setDraft({ date: iso });
                  return;
                }
                // Drill into week view for that day — works for any date (past or future).
                navigateCalendar("week", iso);
              }}
              modifiers={{
                past: (day) => localDateToIso(day) < today,
                blocked: (day) => blockedDates.has(localDateToIso(day)),
              }}
              dayClassName={({ modifiers }) =>
                cn(
                  modifiers.past && !modifiers.selected && "border-dashed bg-muted/60 text-muted-foreground",
                  modifiers.blocked &&
                    !modifiers.past &&
                    "border-red-300 bg-red-50 text-red-900 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-100",
                )
              }
              renderDay={({ iso, modifiers }) => {
                const items = itemsByDate.get(iso) ?? [];
                if (modifiers.blocked) {
                  return (
                    <span className="inline-flex min-w-0 items-center gap-1 text-[0.65rem] font-semibold tracking-wide uppercase">
                      <Icon icon={BlockedIcon} className="size-3 shrink-0" strokeWidth={2.5} />
                      <span className="sr-only sm:not-sr-only sm:truncate">{t.admin.off}</span>
                    </span>
                  );
                }
                if (items.length === 0) return null;
                return (
                  <span className="flex flex-row flex-wrap gap-1">
                    {items.map((item) => (
                      <span
                        key={item.id}
                        aria-label={`${item.time} ${item.title}`}
                        className={cn("block h-2 w-2 rounded-full", monthDotToneClasses(item.type))}
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
      </Card>

      {addOpened ? (
        <AddBookingModal
          open={draft !== null}
          onClose={() => setDraft(null)}
          clients={clients}
          services={services}
          initialDate={draft?.date}
          initialTime={draft?.time}
          bookedByDate={bookedByDate}
        />
      ) : null}

      {detailOpened ? (
        <AppointmentDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          bookedByDate={bookedByDate}
        />
      ) : null}
    </div>
  );
}

function LegendItem({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <li className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tone)} />
      {children}
    </li>
  );
}

// Desktop time grid spans the working day. Each hour is HOUR_HEIGHT px tall, so
// a booking's top offset and height map directly to its start time / duration.
const START_HOUR = 7;
const END_HOUR = 21; // exclusive end — 07:00 open, last book 20:00 (runs to ~21:00)
const GRID_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 64;
const WEEK_GRID_COLUMNS = "64px repeat(7, minmax(0, 1fr))";
// Visible height of the scrollable grid body (the full grid is taller and scrolls).
const VIEWPORT_HEIGHT = 9 * HOUR_HEIGHT;

function minutesFromStart(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours - START_HOUR) * 60 + minutes;
}

// "yyyy-mm-dd" shifted by whole days (pure calendar arithmetic, no local TZ).
function shiftDay(date: string, days: number) {
  return addDaysToDate(date, days);
}

// Single-day agenda: a chronological timeline of the day's items. Navigation
// lives in the shared toolbar; this view reuses the same item model and detail
// modal as the week and month views.
function DayAgenda({
  t,
  date,
  items,
  blocked,
  onAddSlot,
  onSelect,
}: {
  t: Dict;
  date: string;
  items: CalendarItem[];
  blocked: boolean;
  onAddSlot: (date: string, time?: string) => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const today = todayIso();
  const sorted = [...items].sort((a, b) => (a.time < b.time ? -1 : 1));
  const addTime = firstFreeSlot(sorted, date === today);
  const canAdd = date >= today && !blocked;

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {blocked ? (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-500/30">
          <Icon icon={BlockedIcon} className="size-5" strokeWidth={2} />
          {t.admin.off}
        </div>
      ) : null}

      {canAdd ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => onAddSlot(date, addTime)}
          className="w-full sm:w-auto"
        >
          <Icon icon={Add01Icon} strokeWidth={2.2} />
          {t.admin.addAt(addTime)}
        </Button>
      ) : null}

      {date === today ? (
        <p className="flex items-center gap-2 border-l-2 border-red-500 pl-3 text-xs font-semibold text-red-700 dark:text-red-300">
          <Icon icon={Clock01Icon} className="size-3.5" strokeWidth={2} />
          {t.admin.currentTime(timeOfMinutes(nowMinutesInShopTimeZone()))}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          title={t.admin.noAppointments}
          icon={<Icon icon={Calendar03Icon} />}
          action={
            canAdd ? (
              <Button type="button" variant="secondary" onClick={() => onAddSlot(date)}>
                <Icon icon={Add01Icon} strokeWidth={2.2} />
                {t.admin.addBooking}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ol className="space-y-2">
          {sorted.map((item) => {
            const endTime = addMinutesToTime(item.time, item.durationMinutes);
            return (
              <li key={item.id} className="flex gap-3">
                <div className="w-12 shrink-0 pt-3 text-right leading-tight">
                  <span className="block text-sm font-semibold text-foreground tabular-nums">{item.time}</span>
                  <span className="block text-[0.7rem] text-muted-foreground tabular-nums">{endTime}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className={cn(
                    "relative flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl py-3 pr-3 pl-5 text-left transition",
                    neutralChipClasses,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-3 left-2 w-1 rounded-full", accentToneClasses(item.type))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.service} · {item.durationMinutes} {t.admin.minutesShort}
                    </span>
                  </span>
                  {item.outcome === "completed" || item.outcome === "no_show" ? (
                    <StatusPill tone={item.outcome === "completed" ? "success" : "danger"} className="hidden sm:inline-flex">
                      {item.outcome === "completed" ? t.admin.outcomeCompleted : t.admin.outcomeNoShow}
                    </StatusPill>
                  ) : null}
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                    {Math.round(item.finalPriceCents / 100)} €
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Pixel offset of the current time within the grid (clamped to the visible band).
function nowOffsetPx() {
  const minutes = nowMinutesInShopTimeZone() - START_HOUR * 60;
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
        <span className="absolute top-0 left-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
      </div>
    </div>
  );
}

function WeekGrid({
  t,
  locale,
  weekMonday,
  itemsByDate,
  blockedDates,
  onAddSlot,
  onSelect,
}: {
  t: Dict;
  locale: string;
  weekMonday: string;
  itemsByDate: Map<string, CalendarItem[]>;
  blockedDates: Set<string>;
  onAddSlot: (date: string, time: string) => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, index) => addDaysToDate(weekMonday, index));
  const hours = Array.from({ length: GRID_HOURS }, (_, index) => START_HOUR + index);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // Center the current time in the scroll viewport on first open.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(nowOffsetPx() - VIEWPORT_HEIGHT / 2, 0);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateScrollbarWidth = () => {
      setScrollbarWidth(Math.max(0, el.offsetWidth - el.clientWidth));
    };
    updateScrollbarWidth();

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollbarWidth) : null;
    observer?.observe(el);
    window.addEventListener("resize", updateScrollbarWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScrollbarWidth);
    };
  }, []);

  return (
    <>
      {/* Desktop time grid */}
      <div className="hidden overflow-x-auto rounded-2xl lg:block">
        <div className="min-w-245">
          <div className="bg-border" style={{ paddingRight: scrollbarWidth }}>
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: WEEK_GRID_COLUMNS }}
            >
              <div className="bg-card" />
              {days.map((day) => {
                const isToday = day === today;
                const isBlocked = blockedDates.has(day);
                return (
                  <div
                    key={day}
                    className={cn(
                      "px-2 py-3 text-center text-sm font-semibold",
                      isBlocked
                        ? "bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-100"
                        : isToday
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground",
                    )}
                  >
                    {formatDay(day, locale)}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Scrollable time body */}
          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{ height: VIEWPORT_HEIGHT }}
          >
            <div
              className="relative grid gap-px bg-border"
              style={{ gridTemplateColumns: WEEK_GRID_COLUMNS }}
            >
              {/* Time gutter */}
              <div className="bg-card">
                {hours.map((hour) => (
                  <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative">
                    <span className="absolute top-1 right-2 text-xs font-medium text-muted-foreground tabular-nums">
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
      <div className="grid gap-3 p-3 sm:p-4 lg:hidden">
        {days.map((day) => {
          const items = itemsByDate.get(day) ?? [];
          const isToday = day === today;
          const isPast = day < today;
          const isBlocked = blockedDates.has(day);
          const canAdd = !isBlocked && !isPast;
          return (
            <section
              key={day}
              className={cn(
                "rounded-xl border p-3",
                isBlocked
                  ? "border-2 border-red-300 bg-red-50 dark:border-red-500/60 dark:bg-red-500/15"
                  : isToday
                    ? "border-primary bg-card"
                    : "border-transparent bg-card ring-1 ring-foreground/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3
                  className={cn(
                    "text-sm font-semibold text-foreground",
                    isBlocked && "text-red-900 dark:text-red-100",
                  )}
                >
                  {formatDay(day, locale)}
                </h3>
                <div className="flex items-center gap-2">
                  {isBlocked ? <StatusPill tone="danger">{t.admin.off}</StatusPill> : null}
                  {isToday ? <StatusPill tone="neutral" dot>{t.common.today}</StatusPill> : null}
                  {canAdd ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddSlot(day, firstFreeSlot(items, isToday))}
                      className="h-9"
                    >
                      <Icon icon={Add01Icon} strokeWidth={2.2} />
                      {t.admin.addShort}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                  <p
                    className={cn(
                      "rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground",
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
            </section>
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
  const nowMin = nowMinutesInShopTimeZone();
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

function layoutOverlappingItems(items: CalendarItem[]) {
  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
  const active: Array<{ end: number; column: number }> = [];
  const positioned: Array<{ item: CalendarItem; column: number }> = [];
  let columnCount = 1;

  for (const item of sorted) {
    const start = minutesOf(item.time);
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].end <= start) active.splice(index, 1);
    }
    const occupied = new Set(active.map((entry) => entry.column));
    let column = 0;
    while (occupied.has(column)) column += 1;
    active.push({ end: start + item.durationMinutes, column });
    columnCount = Math.max(columnCount, active.length, column + 1);
    positioned.push({ item, column });
  }

  return positioned.map((entry) => ({ ...entry, columnCount }));
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
            ? "bg-muted/60"
            : "bg-card",
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
            isBlocked ? "border-red-200/70 dark:border-red-500/20" : "border-border/60",
          )}
        />
      ))}

      {/* Past-time veil on today's column (above gridlines, below bookings/click) */}
      {isToday && earliest > OPEN_MINUTES && earliest <= CLOSE_MINUTES ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/5"
          style={{ height: ((Math.min(earliest, CLOSE_MINUTES) - OPEN_MINUTES) / 60) * HOUR_HEIGHT }}
        />
      ) : null}

      {/* Click-to-add surface — snaps to the cursor's 15-min slot. Sits beneath
          the booking chips (z-10) so clicks on bookings select rather than add. */}
      {!isBlocked ? (
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
                className="pointer-events-none absolute inset-x-1 flex items-center gap-1 rounded-md border border-dashed border-foreground/30 bg-card/80 px-1.5 text-[0.6rem] font-semibold text-muted-foreground"
                style={{
                  top: ((hoverMin - START_HOUR * 60) / 60) * HOUR_HEIGHT,
                  height: (SNAP_MINUTES / 60) * HOUR_HEIGHT,
                }}
              >
                <Icon icon={Add01Icon} className="size-3" strokeWidth={2.4} />
                {timeOfMinutes(hoverMin)}
              </span>
            ) : null}
        </div>
      ) : null}

      {/* Bookings positioned by start time, sized by duration */}
      {layoutOverlappingItems(items).map(({ item, column, columnCount }) => {
        const top = (minutesFromStart(item.time) / 60) * HOUR_HEIGHT;
        const height = Math.max((item.durationMinutes / 60) * HOUR_HEIGHT, 22);
        const widthPercent = 100 / columnCount;
        return (
          <CalendarChip
            key={item.id}
            item={item}
            style={{
              top,
              height,
              left: `calc(${column * widthPercent}% + 0.25rem)`,
              width: `calc(${widthPercent}% - 0.5rem)`,
            }}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

// Month view shows a tiny color-coded dot per item — too small for an inset
// bar, so the accent color fills it.
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

// Neutral event block — card surface with a hairline ring. The event type is
// conveyed only by the inset accent bar (see accentToneClasses), not a full tint.
const neutralChipClasses =
  "bg-card text-foreground ring-1 ring-foreground/10 hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

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

  return (
    <Tooltip
      content={
        <div className="leading-snug">
          <p className="font-semibold tabular-nums">
            {item.time}–{endTime}
          </p>
          <p>{item.title}</p>
          <p className="opacity-80">{item.service}</p>
        </div>
      }
    >
      <button
        type="button"
        onClick={() => onSelect(item)}
        style={style}
        className={cn(
          "absolute z-10 flex overflow-hidden rounded-md py-0.5 pr-1.5 pl-3.5 text-left leading-tight transition",
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
            <span className="truncate text-xs leading-tight font-semibold">{item.title}</span>
          ) : null}
          <span className="truncate text-[0.65rem] leading-tight text-muted-foreground tabular-nums">
            {item.time}–{endTime}
          </span>
          {showService ? (
            <span className="truncate text-[0.65rem] leading-tight text-muted-foreground">{item.service}</span>
          ) : null}
        </span>
      </button>
    </Tooltip>
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
        "relative flex min-h-12 w-full items-center gap-3 rounded-lg py-2 pr-3 pl-5 text-left transition",
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
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          <span className="tabular-nums">
            {item.time}–{endTime}
          </span>
          {" · "}
          {item.service}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {Math.round(item.finalPriceCents / 100)} €
      </span>
    </button>
  );
}
