import type { AppState, AvailabilityDay, DayWindow, Service } from "./types";

export const services: Service[] = [
  { id: "cut", name: "Signature cut", duration: 45, price: 32 },
  { id: "beard", name: "Beard shape", duration: 30, price: 20 },
  { id: "combo", name: "Cut + beard", duration: 75, price: 48 },
];

export const dayWindows: DayWindow[] = [
  "Morning",
  "Midday",
  "Afternoon",
  "Evening",
];

export const workingHours = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

// Start hour (inclusive) and end hour (exclusive) that each preference window maps to.
export const windowRanges: Record<DayWindow, { start: number; end: number }> = {
  Morning: { start: 9, end: 11.5 },
  Midday: { start: 11.5, end: 13.5 },
  Afternoon: { start: 13.5, end: 16 },
  Evening: { start: 16, end: 18.5 },
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

export function addDays(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function formatDay(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatMonth(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatFullDay(date: string) {
  return new Intl.DateTimeFormat("en", {
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

export function monthLabel(key: string) {
  return formatMonth(`${key}-01`);
}

export function serviceById(id: string, serviceList: Service[] = services) {
  return serviceList.find((service) => service.id === id) ?? serviceList[0] ?? services[0];
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
