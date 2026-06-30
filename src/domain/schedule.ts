import type { AppState, AvailabilityDay, DayWindow, Service } from "./types";

export const services: Service[] = [
  {
    id: "cut",
    name: "Signature cut",
    description: "Detailed haircut with consultation and styling.",
    duration: 45,
    price: 32,
    imageUrl: "/signature.jpg",
  },
  {
    id: "beard",
    name: "Beard shape",
    description: "Beard trim, shape, and hot towel finish.",
    duration: 30,
    price: 20,
    imageUrl: "/beard-shape.jpg",
  },
  {
    id: "combo",
    name: "Cut + beard",
    description: "Full haircut and beard service.",
    duration: 75,
    price: 48,
    imageUrl: "/beard-plus-cut.jpg",
  },
];

export const dayWindows: DayWindow[] = [
  "Morning",
  "Midday",
  "Afternoon",
  "Evening",
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

// 10% surcharge for a slot that leaves a gap (doesn't extend the opening block).
export const GAP_SURCHARGE = 0.1;

export const workingHours = buildSlots(OPEN_MINUTES, LAST_BOOK_MINUTES, 30);

// Quarter-hour slots across the same working window. Used where the barber needs
// finer control than the 30-minute `workingHours` grid, e.g. the admin "add
// booking" time picker.
export const workingHoursQuarterly = buildSlots(OPEN_MINUTES, LAST_BOOK_MINUTES, 15);

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

export function addDays(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
  return serviceList.find((service) => service.id === id) ?? serviceList[0] ?? services[0];
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

export function createCalendarDays(startOffset = 0, length = 21) {
  return Array.from({ length }, (_, index) => addDays(startOffset + index));
}

// Every yyyy-mm-dd from start to end inclusive. Used to expand blocked_times
// ranges (timestamptz) into a flat set of blocked calendar days.
export function eachDate(start: string, end: string) {
  const days: string[] = [];
  const cursor = new Date(`${start.slice(0, 10)}T12:00:00`);
  const last = new Date(`${end.slice(0, 10)}T12:00:00`);

  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function todayIso() {
  return addDays(0);
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
  const start = new Date(iso).getTime();
  const now = Date.now();
  const latest = now + CLIENT_BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return start > now && start <= latest;
}

export function getAvailability(
  state: AppState,
  date: string,
  blockedDates?: ReadonlySet<string>,
): AvailabilityDay {
  const blocked = blockedDates?.has(date) ?? false;
  const booked = state.appointments.filter(
    (appointment) => appointment.date === date,
  ).length;
  const proposed = state.proposals.filter(
    (proposal) => proposal.date === date && proposal.status === "sent",
  ).length;

  return {
    date,
    capacity: dayCapacity,
    booked,
    proposed,
    blocked,
    available: blocked ? 0 : Math.max(dayCapacity - booked - proposed, 0),
  };
}

export function getAvailabilityTone(day: AvailabilityDay) {
  if (day.blocked) {
    return "blocked";
  }

  if (day.available === 0) {
    return "full";
  }

  if (day.available <= 2) {
    return "busy";
  }

  return "open";
}

export function isSameDate(a: string, b: string) {
  return a === b;
}

// ---------------------------------------------------------------------------
// Exact-slot booking + gap pricing.
//
// A client picks an exact start time sized to the service duration. Pricing rule
// ("must extend one tight block"): the slot is BASE price only if it starts at
// opening or directly continues the gapless run of confirmed appointments
// anchored at opening; otherwise it leaves a gap and costs +10%.
// ---------------------------------------------------------------------------

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function timeOfMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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

type SlotAppt = { date: string; time: string; durationMinutes: number };

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
): string[] {
  const starts = new Set<number>();

  for (let start = OPEN_MINUTES; start <= LAST_BOOK_MINUTES; start += 60) {
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
        start >= OPEN_MINUTES &&
        start <= LAST_BOOK_MINUTES &&
        start + durationMin <= CLOSE_MINUTES &&
        isSlotFree(date, start, durationMin, confirmed),
    )
    .sort((a, b) => a - b)
    .map(timeOfMinutes);
}

// The base-price anchor for the day when there are no confirmed bookings yet.
export function contiguousBlockEnd(
  date: string,
  confirmed: SlotAppt[],
  openingMin = OPEN_MINUTES,
): number {
  const ends = confirmed
    .filter((a) => a.date === date)
    .map((a) => minutesOf(a.time) + a.durationMinutes);
  return ends.length === 0 ? openingMin : Math.max(...ends);
}

// Base price iff the slot starts exactly at the day's anchor (opening on an
// empty day, else flush after the last confirmed appointment). Any other start
// leaves a gap and is surcharged.
export function isPreferredStart(startMin: number, blockEndMin: number): boolean {
  return startMin === blockEndMin;
}

// Client best-price starts minimize gaps: opening on an empty day, or any slot
// that touches a confirmed booking directly before or directly after it.
export function isPreferredClientStart(
  date: string,
  startMin: number,
  durationMin: number,
  confirmed: SlotAppt[],
): boolean {
  const dayBookings = confirmed.filter((booking) => booking.date === date);
  if (dayBookings.length === 0) return startMin === OPEN_MINUTES;

  return dayBookings.some((booking) => {
    const bookingStart = minutesOf(booking.time);
    const bookingEnd = bookingStart + booking.durationMinutes;
    return startMin + durationMin === bookingStart || startMin === bookingEnd;
  });
}

// Whole-euro price; +10% (rounded) when the slot isn't preferred.
export function priceForSlot(basePrice: number, preferred: boolean): number {
  return preferred ? basePrice : Math.round(basePrice * (1 + GAP_SURCHARGE));
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
