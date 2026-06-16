import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminCalendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const availabilityManager = readFileSync(
  "src/components/admin/availability-manager.tsx",
  "utf8",
);

test("admin month calendar hides event label text on mobile while keeping colored pills", () => {
  assert.match(adminCalendar, /h-2[^"]*sm:h-auto/);
  assert.match(adminCalendar, /sr-only sm:not-sr-only/);
  assert.match(adminCalendar, /hidden sm:block/);
});

test("availability month calendar hides blocked-day label text on mobile while keeping colored pills", () => {
  assert.match(availabilityManager, /h-2[^"]*sm:h-auto/);
  assert.match(availabilityManager, /sr-only sm:not-sr-only/);
});

test("month calendars can color the whole blocked day cell red", () => {
  const monthCalendar = readFileSync("src/components/shared/month-calendar.tsx", "utf8");

  assert.match(monthCalendar, /dayClassName\?: \(cell: MonthCell\) => string/);
  assert.match(adminCalendar, /dayClassName=\{\(cell\) =>/);
  assert.match(availabilityManager, /dayClassName=\{\(cell\) =>/);
  assert.match(adminCalendar, /bg-red-50[^"]*dark:bg-red-500\/15/);
  assert.match(availabilityManager, /bg-red-50[^"]*dark:bg-red-500\/15/);
});

test("admin calendar distinguishes confirmed, barber-added, and proposed colors", () => {
  assert.match(adminCalendar, /type: appointment\.requestId \? "Confirmed" : "Barber"/);
  assert.match(adminCalendar, /type: "Confirmed" \| "Barber" \| "Proposed"/);
  assert.match(adminCalendar, /case "Confirmed":[\s\S]*bg-emerald-100/);
  assert.match(adminCalendar, /case "Barber":[\s\S]*bg-blue-100/);
  assert.match(adminCalendar, /case "Proposed":[\s\S]*bg-orange-100/);
});

test("week calendar marks blocked days red on desktop and mobile", () => {
  assert.match(adminCalendar, /blockedDates=\{blockedDates\}/);
  assert.match(adminCalendar, /isBlocked=\{blockedDates\.has\(day\)\}/);
  assert.match(adminCalendar, /isBlocked\s*\?\s*"bg-red-50/);
  assert.match(adminCalendar, /isBlocked\s*\?\s*t\.admin\.off\s*:\s*t\.admin\.noAppointments/);
});

test("blocked days do not allow adding bookings in week or month views", () => {
  assert.match(adminCalendar, /disabled=\{isBlocked\}/);
  assert.match(adminCalendar, /title=\{isBlocked \? undefined : t\.admin\.addBookingAt/);
  assert.match(adminCalendar, /isBlocked \? null : \(/);
  assert.match(adminCalendar, /onClick=\{\(\) => onAddSlot\(day, "09:00"\)\}/);
  assert.match(adminCalendar, /onDayClick=\{\(cell\) => \{/);
  assert.match(adminCalendar, /if \(items\.length === 0 && !blockedDates\.has\(cell\.date\)\) \{/);
  assert.match(adminCalendar, /setDraft\(\{ date: cell\.date \}\)/);
  assert.match(adminCalendar, /if \(blocked\) \{/);
});
