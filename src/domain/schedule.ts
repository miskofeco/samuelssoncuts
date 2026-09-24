import type {
  BookingRequest,
  BlockedInterval,
  BlockedRange,
  BusinessHoursDay,
  DayWindow,
  PricingSettings,
  ConfirmedRequestSlot,
  Proposal,
  Service,
} from "./types";
import {
  addDaysToDate,
  dateInShopTimeZone,
  nowMinutesInShopTimeZone,
  shopDayRangeUtc,
  timeInShopTimeZone,
  zonedDateTimeToUtcIso,
} from "../lib/time-zone";

export const services: Service[] = [
  {
    id: "cut",
    name: "Signature cut",
    description: "Detailed haircut with consultation and styling.",
    duration: 45,
    price: 32,
    sundayPrice: 32,
    imageUrl: "/signature.jpg",
  },
  {
    id: "beard",
    name: "Beard shape",
    description: "Beard trim, shape, and hot towel finish.",
    duration: 30,
    price: 20,
    sundayPrice: 20,
    imageUrl: "/beard-shape.jpg",
  },
  {
    id: "combo",
    name: "Cut + beard",
    description: "Full haircut and beard service.",
    duration: 75,
    price: 48,
    sundayPrice: 48,
    imageUrl: "/beard-plus-cut.jpg",
  },
];

// The shop opens at 07:00; the last bookable start is 20:00 (so a visit can run
// to ~21:00). Generated rather than listed so the range stays easy to change.
function buildSlots(startMinutes: number, endMinutes: number, stepMinutes: number) {
  const slots: string[] = [];
  for (let total = startMinutes; total <= endMinutes; total += stepMinutes) {
    slots.push(
      `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
    );
  }
  return slots;
}

export const OPEN_MINUTES = 7 * 60; // 07:00
const LAST_BOOK_MINUTES = 20 * 60; // 20:00 — last bookable start
export const CLOSE_MINUTES = 21 * 60; // 21:00 — shop closes (a visit may run to here)

// Default surcharges, stored as whole percentages so barber settings can use
// the same values the UI displays.
export const DEFAULT_GAP_SURCHARGE_PERCENT = 10;
export const DEFAULT_VIP_SURCHARGE_PERCENT = 20;
export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  gapSurchargePercent: DEFAULT_GAP_SURCHARGE_PERCENT,
  vipSurchargePercent: DEFAULT_VIP_SURCHARGE_PERCENT,
};
export const VIP_START_MINUTES = 17 * 60;

export const workingHours = buildSlots(OPEN_MINUTES, LAST_BOOK_MINUTES, 30);

// Start hour (inclusive) and end hour (exclusive) that each preference window maps to.
export const windowRanges: Record<DayWindow, { start: number; end: number }> = {
  Morning: { start: 7, end: 11.5 },
  Midday: { start: 11.5, end: 13.5 },
  Afternoon: { start: 13.5, end: 16 },
  Evening: { start: 16, end: 20.5 },
};

function hourValue(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours + minutes / 60;
}

export function hoursInWindow(window: DayWindow) {
  const range = windowRanges[window];
  return workingHours.filter((hour) => {
    const value = hourValue(hour);
    return value >= range.start && value < range.end;
  });
}

export function windowForTime(time: string): DayWindow {
  const value = hourValue(time);
  const match = (Object.keys(windowRanges) as DayWindow[]).find((window) => {
    const range = windowRanges[window];
    return value >= range.start && value < range.end;
  });
  return match ?? "Morning";
}

export const dayCapacity = 7;
export const CLIENT_BOOKING_WINDOW_DAYS = 14;

function addDaysToIsoDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function addDays(days: number) {
  return addDaysToIsoDate(todayIso(), days);
}

// The optional `locale` lets callers localize dates (e.g. "sk-SK"). It defaults
// to English so any call site not yet threading the locale keeps working.
export function formatDay(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatMonth(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatFullDay(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatBlockedRange(range: BlockedRange, locale = "en-US"): string {
  const first = formatFullDay(range.start, locale);
  if (range.start === range.end) {
    if (range.startTime || range.endTime) {
      return `${first} · ${range.startTime ?? "00:00"}–${range.endTime ?? "24:00"}`;
    }
    return first;
  }
  const last = formatFullDay(range.end, locale);
  return `${first}${range.startTime ? ` ${range.startTime}` : ""} – ${last}${range.endTime ? ` ${range.endTime}` : ""}`;
}

export type MonthCell = {
  date: string; // yyyy-mm-dd
  inMonth: boolean;
  isToday: boolean;
};

/** "yyyy-mm" key for a date string. */
export function monthKey(date: string) {
  return date.slice(0, 7);
}

/** Shift a "yyyy-mm" key by N months. */
/** ISO date of the Monday that starts the week containing `date`. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Shift a week start date by `delta` weeks. */
export function shiftWeek(monday: string, delta: number): string {
  const d = new Date(`${monday}T12:00:00`);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

/** Label for a week given its Monday ISO date. */
export function weekLabel(monday: string, locale = "en-US"): string {
  const sunday = new Date(`${monday}T12:00:00`);
  sunday.setDate(sunday.getDate() + 6);
  const sunIso = sunday.toISOString().slice(0, 10);
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  return `${fmt.format(new Date(`${monday}T12:00:00`))} – ${fmt.format(new Date(`${sunIso}T12:00:00`))}`;
}

export function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const base = new Date(year, month - 1 + delta, 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

/** A 6-week (42-cell) grid for the given "yyyy-mm", Monday-first. */
export function monthGrid(key: string): MonthCell[] {
  const [year, month] = key.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  // Monday-first offset: JS getDay() is 0=Sun..6=Sat.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - offset);
  const today = todayIso();

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
      day.getDate(),
    ).padStart(2, "0")}`;
    return {
      date: iso,
      inMonth: day.getMonth() === month - 1,
      isToday: iso === today,
    };
  });
}

export function monthLabel(key: string, locale = "en-US") {
  return formatMonth(`${key}-01`, locale);
}

export function serviceById(id: string, serviceList: Service[] = services) {
  const matched = serviceList.find((service) => service.id === id);
  if (matched) return matched;
  if (!id) return serviceList[0] ?? services[0];
  // A missing historical service must not masquerade as today's first item.
  return { id, name: "—", duration: 0, price: 0, sundayPrice: 0, active: false } satisfies Service;
}

/** The appointment row is authoritative when a request has been rescheduled. */
export function bookedSlotForRequest(
  request: Pick<BookingRequest, "requestedDate" | "requestedTime">,
  proposal?: Pick<Proposal, "date" | "time" | "status">,
  confirmed?: Pick<ConfirmedRequestSlot, "date" | "time">,
): { date: string; time: string } | null {
  if (confirmed) return { date: confirmed.date, time: confirmed.time };
  if (proposal?.status === "accepted") return { date: proposal.date, time: proposal.time };
  if (request.requestedDate && request.requestedTime) {
    return { date: request.requestedDate, time: request.requestedTime };
  }
  return null;
}

export function defaultServiceImage(service: Pick<Service, "name" | "imageUrl">) {
  if (service.imageUrl?.trim()) return service.imageUrl.trim();

  const normalized = service.name.toLowerCase();
  if (normalized.includes("beard") && (normalized.includes("cut") || normalized.includes("+"))) {
    return "/beard-plus-cut.jpg";
  }
  if (normalized.includes("beard")) return "/beard-shape.jpg";
  return "/signature.jpg";
}

export function defaultClientServiceId(serviceList: Service[]) {
  return (
    serviceList.find((service) => service.name.toLowerCase().includes("signature"))?.id ??
    serviceList[0]?.id ??
    ""
  );
}

export function orderClientServices(serviceList: Service[]) {
  const rank = (service: Service) => {
    const normalized = service.name.toLowerCase();
    if (normalized.includes("signature")) return 0;
    if (normalized.includes("beard") && (normalized.includes("cut") || normalized.includes("+"))) return 2;
    if (normalized.includes("beard")) return 1;
    return 3;
  };
  return serviceList
    .map((service, index) => ({ service, index }))
    .sort((a, b) => rank(a.service) - rank(b.service) || a.index - b.index)
    .map(({ service }) => service);
}

// Every yyyy-mm-dd from start to end inclusive. Used to expand blocked_times
// ranges (timestamptz) into a flat set of blocked calendar days.
// Shop-local calendar dates covered by an instant range. `end` is treated as
// exclusive at the millisecond level, so a whole-day block stored as
// [day 00:00, next day 00:00) yields only `day`, while legacy rows ending at
// 23:59:59 and intra-day slices keep yielding their own day. Plain yyyy-mm-dd
// inputs are accepted as-is.
export function eachDate(start: string, end: string) {
  const first = isoDateOnly(start) ? start : dateInShopTimeZone(start);
  const last = isoDateOnly(end)
    ? end
    : dateInShopTimeZone(new Date(new Date(end).getTime() - 1).toISOString());

  const days: string[] = [];
  for (let cursor = first; cursor <= last; cursor = addDaysToDate(cursor, 1)) {
    days.push(cursor);
  }

  return days.length > 0 ? days : [first];
}

/**
 * Quarter-hour wall times across the shop window (07:00–21:00) for admin time
 * pickers. A saved value off that grid stays selectable instead of vanishing.
 */
export function quarterHourTimes(current?: string): string[] {
  const times = buildSlots(OPEN_MINUTES, CLOSE_MINUTES, 15);
  return current && !times.includes(current) ? [...times, current].sort() : times;
}

/** Blocking reasons are required and kept to a few words. */
export const BLOCK_REASON_MIN_LENGTH = 2;
export const BLOCK_REASON_MAX_LENGTH = 40;

export function isValidBlockReason(value: string): boolean {
  const length = value.trim().length;
  return length >= BLOCK_REASON_MIN_LENGTH && length <= BLOCK_REASON_MAX_LENGTH;
}

/**
 * A blocked_times row as shop-local dates plus wall times only where the block
 * does not start/end at a shop midnight. Instants are compared numerically:
 * Supabase returns "+00:00" offsets while computed midnights use toISOString's
 * "Z", so string comparison would label every whole-day block "00:00–00:00".
 * `window` clips long blocks to the loaded range.
 */
export function blockedRangeFromRow(
  row: { id: string; starts_at: string; ends_at: string; reason: string | null },
  window?: { fromIso: string; toIso: string },
): BlockedRange {
  const startMs = Math.max(Date.parse(row.starts_at), window ? Date.parse(window.fromIso) : -Infinity);
  const endMs = Math.min(Date.parse(row.ends_at), window ? Date.parse(window.toIso) : Infinity);
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  // Whole-day blocks end at the NEXT shop day's midnight (exclusive), so the
  // last covered day comes from eachDate rather than the raw end instant.
  const days = eachDate(startIso, endIso);
  const firstDay = days[0] ?? dateInShopTimeZone(startIso);
  const lastDay = days[days.length - 1] ?? dateInShopTimeZone(endIso);
  return {
    id: row.id,
    start: firstDay,
    end: lastDay,
    startTime: startMs === Date.parse(shopDayRangeUtc(firstDay).startIso) ? null : timeInShopTimeZone(startIso),
    endTime: endMs === Date.parse(shopDayRangeUtc(lastDay).endIso) ? null : timeInShopTimeZone(endIso),
    reason: row.reason,
  };
}

/** Distinct block reasons touching a shop-local day, in start order. */
export function blockReasonsForDate(date: string, intervals: readonly BlockedInterval[]): string[] {
  const { startIso, endIso } = shopDayRangeUtc(date);
  const dayStart = Date.parse(startIso);
  const dayEnd = Date.parse(endIso);
  const reasons: string[] = [];
  for (const interval of [...intervals].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    const reason = interval.reason?.trim();
    if (!reason || reasons.includes(reason)) continue;
    if (Date.parse(interval.start) < dayEnd && Date.parse(interval.end) > dayStart) reasons.push(reason);
  }
  return reasons;
}

/** A partial block affects a slot only when their half-open UTC ranges overlap. */
export function isSlotBlocked(
  date: string,
  time: string,
  durationMinutes: number,
  intervals: readonly BlockedInterval[],
): boolean {
  const start = Date.parse(zonedDateTimeToUtcIso(date, time));
  const end = start + durationMinutes * 60_000;
  return intervals.some((interval) =>
    start < Date.parse(interval.end) && Date.parse(interval.start) < end,
  );
}

/** Covers every instant of the local calendar day, including DST-short/long days. */
export function isShopDayFullyBlocked(
  date: string,
  intervals: readonly BlockedInterval[],
): boolean {
  const { startIso, endIso } = shopDayRangeUtc(date);
  const dayStart = Date.parse(startIso);
  const dayEnd = Date.parse(endIso);
  const sorted = intervals
    .map(({ start, end }) => ({ start: Date.parse(start), end: Date.parse(end) }))
    .filter((range) => range.start < dayEnd && range.end > dayStart)
    .sort((a, b) => a.start - b.start);
  let coveredUntil = dayStart;
  for (const range of sorted) {
    if (range.start > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, range.end);
    if (coveredUntil >= dayEnd) return true;
  }
  return false;
}

function isoDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function todayIso() {
  return dateInShopTimeZone(new Date().toISOString());
}

export function latestClientBookingDate() {
  return addDays(CLIENT_BOOKING_WINDOW_DAYS);
}

export function isDateInClientBookingWindow(date: string) {
  return date >= todayIso() && date <= latestClientBookingDate();
}

export function isStartInFuture(iso: string) {
  return new Date(iso).getTime() > Date.now();
}

export function isStartInClientBookingWindow(iso: string) {
  return isStartInFuture(iso) && isDateInClientBookingWindow(dateInShopTimeZone(iso));
}

// ---------------------------------------------------------------------------
// Exact-slot booking and shared client/admin price suggestions. A start at the
// opening of an empty day or touching a confirmed appointment gets base price
// before 17:00; other daytime starts get the configured gap surcharge. Starts
// at or after 17:00 always get the configured VIP surcharge.
// ---------------------------------------------------------------------------

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timeOfMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function addMinutesToTime(time: string, minutes: number) {
  return timeOfMinutes(minutesOf(time) + minutes);
}

// Candidate start times (stepped, default 15 min) whose end fits before close.
export function slotsForService(durationMin: number, step = 15): string[] {
  const slots: string[] = [];
  for (let start = OPEN_MINUTES; start <= LAST_BOOK_MINUTES; start += step) {
    if (start + durationMin <= CLOSE_MINUTES) slots.push(timeOfMinutes(start));
  }
  return slots;
}

// Half-open interval overlap [startA, startA+durA) ∩ [startB, startB+durB).
export function overlaps(startA: number, durA: number, startB: number, durB: number): boolean {
  return startA < startB + durB && startB < startA + durA;
}

export type AdminBookedSlot = {
  id: string;
  time: string;
  durationMinutes: number;
};

export type AdminSlotOption = {
  value: string;
  label: string;
  disabledReason: "past" | "conflict" | "closed" | "blocked" | null;
  /** Why clients could not book this start, even when the barber may override it. */
  unavailableReason: "closed" | "blocked" | null;
};

/** Shared add/reschedule options, evaluated against the shop wall clock. */
export function adminSlotOptions({
  durationMinutes,
  bookedToday,
  date,
  excludeId,
  businessHours,
  blockedIntervals = [],
  now = new Date(),
  allowUnavailable = false,
}: {
  durationMinutes: number;
  bookedToday: AdminBookedSlot[];
  date?: string;
  excludeId?: string;
  businessHours?: SlotBusinessHoursDay[];
  blockedIntervals?: readonly BlockedInterval[];
  now?: Date;
  /**
   * The barber confirmed booking outside availability: offer the whole shop
   * window and enable closed/blocked starts. Past and overlapping starts stay
   * disabled.
   */
  allowUnavailable?: boolean;
}): AdminSlotOption[] {
  const today = dateInShopTimeZone(now.toISOString());
  const nowMinutes = nowMinutesInShopTimeZone(now);
  const dayHours = date ? businessHoursForDate(date, businessHours) : undefined;
  const opens = dayHours ? minutesOf(dayHours.opensAt) : OPEN_MINUTES;
  const closes = dayHours ? minutesOf(dayHours.closesAt) : CLOSE_MINUTES;
  const options = allowUnavailable
    ? durationMinutes > 0
      ? buildSlots(
        Math.min(opens, OPEN_MINUTES),
        Math.max(closes, CLOSE_MINUTES) - durationMinutes,
        15,
      )
      : []
    : dayHours
      ? closes > opens && durationMinutes > 0
        ? buildSlots(opens, closes - durationMinutes, 15)
        : []
      : slotsForService(durationMinutes);

  return options.map((time) => {
    const startMin = minutesOf(time);
    const conflict = bookedToday.some(
      (slot) =>
        slot.id !== excludeId &&
        overlaps(startMin, durationMinutes, minutesOf(slot.time), slot.durationMinutes),
    );
    const past = Boolean(date && (date < today || (date === today && startMin <= nowMinutes)));
    const blocked = Boolean(date && isSlotBlocked(date, time, durationMinutes, blockedIntervals));
    const outsideHours = Boolean(dayHours?.closed) ||
      startMin < opens ||
      startMin + durationMinutes > closes;
    const unavailableReason = outsideHours ? "closed" : blocked ? "blocked" : null;
    return {
      value: time,
      label: time,
      disabledReason: past
        ? "past"
        : unavailableReason && !allowUnavailable
          ? unavailableReason
          : conflict
            ? "conflict"
            : null,
      unavailableReason,
    };
  });
}

export type SlotAppt = { date: string; time: string; durationMinutes: number };
export type SlotBusinessHoursDay = Pick<
  BusinessHoursDay,
  "weekday" | "opensAt" | "closesAt" | "closed"
>;

function weekdayForDate(date: string) {
  return new Date(`${date}T12:00:00`).getDay();
}

export function businessHoursForDate(
  date: string,
  businessHours?: SlotBusinessHoursDay[],
): SlotBusinessHoursDay | undefined {
  return businessHours?.find((day) => day.weekday === weekdayForDate(date));
}

export function isDateClosedForBusinessHours(
  date: string,
  businessHours?: SlotBusinessHoursDay[],
): boolean {
  return businessHoursForDate(date, businessHours)?.closed === true;
}

const MINUTES_PER_DAY = 24 * 60;

/** A closed stretch of a shop day in minutes-of-day, half-open [start, end). */
export type ClosedPeriod = {
  startMinutes: number;
  endMinutes: number;
  /** `closed` = outside the weekday's opening hours; `blocked` = a blocked-time range. */
  kind: "closed" | "blocked";
  /** The block's reason, when the interval carried one (admin calendar only). */
  reason?: string;
};

export type DayAvailability = {
  /** No bookable minute remains inside the opening window. */
  closedAllDay: boolean;
  opensAt: number;
  closesAt: number;
  closedPeriods: ClosedPeriod[];
};

/**
 * Everything the admin calendar needs to mark a day's unavailable time: the
 * weekday's opening window (or the default shop window when none is stored)
 * and any blocked-time ranges clipped to the shop-local day. The booking
 * modal and server guards enforce the same hours and blocks.
 */
export function dayAvailability(
  date: string,
  businessHours: SlotBusinessHoursDay[] | undefined,
  blockedIntervals: readonly BlockedInterval[],
): DayAvailability {
  const dayHours = businessHoursForDate(date, businessHours);
  const opensAt = dayHours ? minutesOf(dayHours.opensAt) : OPEN_MINUTES;
  const closesAt = dayHours ? minutesOf(dayHours.closesAt) : CLOSE_MINUTES;
  const closedPeriods: ClosedPeriod[] = [];

  if (dayHours?.closed || closesAt <= opensAt) {
    closedPeriods.push({ startMinutes: 0, endMinutes: MINUTES_PER_DAY, kind: "closed" });
  } else {
    if (opensAt > 0) closedPeriods.push({ startMinutes: 0, endMinutes: opensAt, kind: "closed" });
    if (closesAt < MINUTES_PER_DAY) {
      closedPeriods.push({ startMinutes: closesAt, endMinutes: MINUTES_PER_DAY, kind: "closed" });
    }
  }

  const { startIso, endIso } = shopDayRangeUtc(date);
  const dayStart = Date.parse(startIso);
  const dayEnd = Date.parse(endIso);
  for (const interval of blockedIntervals) {
    const start = Date.parse(interval.start);
    const end = Date.parse(interval.end);
    if (start >= dayEnd || end <= dayStart) continue;
    const startMinutes = start <= dayStart ? 0 : minutesOf(timeInShopTimeZone(interval.start));
    const endMinutes = end >= dayEnd ? MINUTES_PER_DAY : minutesOf(timeInShopTimeZone(interval.end));
    if (endMinutes > startMinutes) {
      const reason = interval.reason?.trim();
      closedPeriods.push({ startMinutes, endMinutes, kind: "blocked", ...(reason ? { reason } : {}) });
    }
  }
  closedPeriods.sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  // The day is off when the closed/blocked periods cover the whole opening window.
  let coveredUntil = opensAt;
  for (const period of closedPeriods) {
    if (period.startMinutes > coveredUntil) break;
    coveredUntil = Math.max(coveredUntil, period.endMinutes);
  }

  return {
    closedAllDay: coveredUntil >= closesAt,
    opensAt,
    closesAt,
    closedPeriods,
  };
}

/** Whether a booking may not start at `minute` (minutes-of-day) on this day. */
export function isMinuteUnavailable(availability: DayAvailability, minute: number): boolean {
  return availability.closedPeriods.some(
    (period) => minute >= period.startMinutes && minute < period.endMinutes,
  );
}

/**
 * Which kind of unavailable time covers `minute`: an explicit block wins over
 * closed opening hours, so blocked time is always shown and named as blocked.
 */
export function unavailableKindAt(
  availability: DayAvailability,
  minute: number,
): ClosedPeriod["kind"] | null {
  let kind: ClosedPeriod["kind"] | null = null;
  for (const period of availability.closedPeriods) {
    if (minute < period.startMinutes || minute >= period.endMinutes) continue;
    if (period.kind === "blocked") return "blocked";
    kind = "closed";
  }
  return kind;
}

// A slot is taken only by CONFIRMED appointments that overlap it. Pending
// requests never block (concurrency is intentional until the barber confirms).
export function isSlotFree(
  date: string,
  startMin: number,
  durationMin: number,
  confirmed: SlotAppt[],
): boolean {
  return !confirmed.some(
    (a) => a.date === date && overlaps(startMin, durationMin, minutesOf(a.time), a.durationMinutes),
  );
}

// Client-facing candidates: regular hourly starts, plus dynamic starts around
// existing confirmed bookings so gaps like 09:30 after a 09:00-09:30 visit are
// offered without returning to a noisy all-15-minute grid.
export function clientSlotsForService(
  date: string,
  durationMin: number,
  confirmed: SlotAppt[],
  businessHours?: SlotBusinessHoursDay[],
): string[] {
  const dayHours = businessHoursForDate(date, businessHours);
  if (dayHours?.closed) return [];

  const opens = dayHours ? minutesOf(dayHours.opensAt) : OPEN_MINUTES;
  const closes = dayHours ? minutesOf(dayHours.closesAt) : CLOSE_MINUTES;
  if (closes <= opens) return [];

  const starts = new Set<number>();
  starts.add(opens);

  // Hourly anchors across the day's CONFIGURED hours. Seeding from the
  // hard-coded 07:00–20:00 grid meant extended opening hours set by the barber
  // could never be booked by clients.
  for (let start = opens; start + durationMin <= closes; start += 60) {
    starts.add(start);
  }

  for (const booking of confirmed) {
    if (booking.date !== date) continue;
    const bookingStart = minutesOf(booking.time);
    const bookingEnd = bookingStart + booking.durationMinutes;
    starts.add(bookingStart - durationMin);
    starts.add(bookingEnd);
  }

  return [...starts]
    .filter(
      (start) =>
        start >= opens &&
        start + durationMin <= closes &&
        isSlotFree(date, start, durationMin, confirmed),
    )
    .sort((a, b) => a - b)
    .map(timeOfMinutes);
}

// Client best-price starts minimize gaps: opening on an empty day, or any slot
// that touches a confirmed booking directly before or directly after it.
export function isPreferredClientStart(
  date: string,
  startMin: number,
  durationMin: number,
  confirmed: SlotAppt[],
  businessHours?: SlotBusinessHoursDay[],
): boolean {
  const dayHours = businessHoursForDate(date, businessHours);
  const openingMin = dayHours ? minutesOf(dayHours.opensAt) : OPEN_MINUTES;
  const dayBookings = confirmed.filter((booking) => booking.date === date);
  if (dayBookings.length === 0) return startMin === openingMin;

  return dayBookings.some((booking) => {
    const bookingStart = minutesOf(booking.time);
    const bookingEnd = bookingStart + booking.durationMinutes;
    return startMin + durationMin === bookingStart || startMin === bookingEnd;
  });
}

export type SlotPricingOptions = Partial<PricingSettings> & {
  startsAt?: string;
};

export type SlotPriceKind = "base" | "gap" | "vip";

export type SurchargeDetails = {
  kind: Exclude<SlotPriceKind, "base">;
  percent: number;
};

export function isVipStart(time: string): boolean {
  return minutesOf(time) >= VIP_START_MINUTES;
}

/**
 * Explains a price captured on a booking request. New VIP requests can be
 * identified from their original requested start; legacy surcharged rows did
 * not store a kind and therefore retain the historical gap classification.
 */
export function surchargeDetailsForRequest(
  request: Pick<BookingRequest, "surcharge" | "requestedTime">,
  pricingSettings: PricingSettings,
): SurchargeDetails | null {
  if (!request.surcharge) return null;
  const kind = request.requestedTime && isVipStart(request.requestedTime) ? "vip" : "gap";
  return {
    kind,
    percent:
      kind === "vip"
        ? pricingSettings.vipSurchargePercent
        : pricingSettings.gapSurchargePercent,
  };
}

export function priceKindForSlot(preferred: boolean, options: SlotPricingOptions = {}): SlotPriceKind {
  if (options.startsAt && isVipStart(options.startsAt)) return "vip";
  if (preferred) return "base";
  return "gap";
}

/** Round an amount in cents to whole euros (half a euro rounds up). */
function wholeEuroCents(cents: number): number {
  return Math.round(cents / 100) * 100;
}

// Prices are whole euros: the catalog base is whole (migration 0049) and the
// surcharged total is rounded once to the nearest euro, halves up. The
// surcharge math stays in integers until that final rounding. VIP starts take
// precedence over connecting best-price starts.
export function priceCentsForSlot(
  basePriceCents: number,
  preferred: boolean,
  options: SlotPricingOptions = {},
): number {
  const wholeBaseCents = wholeEuroCents(basePriceCents);
  const kind = priceKindForSlot(preferred, options);
  if (kind === "base") return wholeBaseCents;

  const surchargePercent =
    kind === "vip"
      ? options.vipSurchargePercent ?? DEFAULT_VIP_SURCHARGE_PERCENT
      : options.gapSurchargePercent ?? DEFAULT_GAP_SURCHARGE_PERCENT;
  return wholeEuroCents((wholeBaseCents * (100 + surchargePercent)) / 100);
}

/** Shop-calendar Sunday check for a "yyyy-mm-dd" day (no clock time involved). */
export function isSundayDate(date: string): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

/**
 * Service list price (euros) that applies on `date`: Sundays use the
 * barber-set Sunday price, every other day the regular price. Gap and VIP
 * surcharges are applied on top of this base.
 */
export function servicePriceForDate(
  service: Pick<Service, "price" | "sundayPrice">,
  date: string | null | undefined,
): number {
  return date && isSundayDate(date) ? service.sundayPrice : service.price;
}

/** Euro display value derived from the same whole-euro calculation. */
export function priceForSlot(
  basePrice: number,
  preferred: boolean,
  options: SlotPricingOptions = {},
): number {
  return priceCentsForSlot(Math.round(basePrice * 100), preferred, options) / 100;
}

/**
 * Parse a barber-entered whole-euro amount into cents. A zero decimal part
 * ("20.00", "20,0") is tolerated; any real cents are rejected.
 */
export function parseEuroCents(value: string): number | null {
  const match = /^(\d{1,5})(?:[.,]0{1,2})?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100;
  return cents <= 1_000_000 ? cents : null;
}

/**
 * Display a stored price in cents. Whole euros (every new price) show no
 * decimals; legacy snapshots with cents keep their exact amount.
 */
export function formatEuroAmount(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export type SlotStatus = "taken" | "requested" | "free";

// "taken" = overlaps a confirmed appointment (hidden/disabled in the picker),
// "requested" = some other client has a pending (unconfirmed) request at this
// exact start (soft badge, still selectable), else "free".
export function slotStatusFor(
  date: string,
  startMin: number,
  durationMin: number,
  confirmed: SlotAppt[],
  pendingStarts: ReadonlySet<string>,
): SlotStatus {
  if (!isSlotFree(date, startMin, durationMin, confirmed)) return "taken";
  if (pendingStarts.has(`${date}T${timeOfMinutes(startMin)}`)) return "requested";
  return "free";
}
