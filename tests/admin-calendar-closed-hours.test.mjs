import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const calendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const modal = readFileSync("src/components/admin/add-booking-modal.tsx", "utf8");

test("admin calendar derives closed time from opening hours and partial blocks", () => {
  assert.match(calendar, /const availabilityFor = \(date: string\) => dayAvailability\(date, businessHours, blockedIntervals\)/);
  assert.match(calendar, /if \(!blockedDates\.has\(date\) && !availability\.closedAllDay\) return null;/);
  assert.match(calendar, /return closedWeekday && !blockedDates\.has\(date\) \? "closed" : "blocked";/);
  // Week, day and month views all use the same day-off rule.
  assert.match(calendar, /dayOffKind=\{dayOffKind\}/);
  assert.match(calendar, /dayOff=\{dayOffKind\(selectedDate\)\}/);
  assert.match(calendar, /closed: \(day\) => dayOffKind\(localDateToIso\(day\)\) === "closed"/);
  assert.doesNotMatch(calendar, /blockedDates=\{blockedDates\}/);
});

test("week columns shade closed periods without labels and route clicks through confirmation", () => {
  assert.match(calendar, /\[\.\.\.availability\.closedPeriods\]/);
  // Bands are plain shading: no icon or "closed" title inside them.
  assert.doesNotMatch(calendar, /period\.kind === "blocked" \? t\.admin\.blockedShort : t\.admin\.off/);
  assert.match(calendar, /if \(minuteIsBusy\(minute\) \|\| minute < earliest\) return;\s*onAddSlot\(day, timeOfMinutes\(minute\)\)/);
  assert.match(calendar, /hoverKind === "blocked"\s*\?\s*"border-red-400\/70/);
  // "+ Add" defaults skip closed time and disappear when nothing is bookable.
  assert.match(calendar, /function firstFreeSlot\(items: CalendarItem\[\], isToday: boolean, availability: DayAvailability\)/);
  assert.match(calendar, /if \(isMinuteUnavailable\(availability, minute\)\) continue;/);
});

test("manual booking explains closed or out-of-hours times instead of reporting an overlap", () => {
  assert.match(modal, /\? t\.admin\.dayClosedHint/);
  assert.match(modal, /!selected\s*\?\s*t\.feedback\.slotOutsideHours/);
  assert.match(modal, /selected\.disabledReason === "closed" \|\| selected\.disabledReason === "blocked"\s*\?\s*t\.feedback\.slotUnavailable/);
});

test("closed or blocked time needs the barber's confirmation before the booking modal opens", () => {
  assert.match(calendar, /const requestAdd = \(date: string, time\?: string\) => \{/);
  assert.match(calendar, /if \(reason\) \{\s*setUnavailableDraft\(\{ date, time, reason \}\);\s*return;\s*\}/);
  assert.match(calendar, /setDraft\(\{ date: unavailableDraft\.date, time: unavailableDraft\.time, allowUnavailable: true \}\)/);
  assert.equal((calendar.match(/onAddSlot=\{requestAdd\}/g) ?? []).length, 2);
  assert.match(calendar, /allowUnavailable=\{draft\?\.allowUnavailable\}/);
});

test("the booking form only sends the override for a confirmed closed or blocked slot", () => {
  assert.match(modal, /export function UnavailableBookingConfirm/);
  assert.match(modal, /const \[overrideAvailability, setOverrideAvailability\] = useState\(allowUnavailable\)/);
  assert.match(modal, /allowUnavailable: overrideAvailability,/);
  assert.match(modal, /const selectedUnavailable = overrideAvailability && Boolean\(selected\?\.unavailableReason\)/);
  assert.match(modal, /allowUnavailable: selectedUnavailable,/);
  assert.match(modal, /setOverrideAvailability\(true\)/);
});

test("server and database waive only hours and blocks for an explicit admin override", () => {
  const actions = readFileSync("src/app/actions.ts", "utf8");
  const guards = readFileSync("src/server/booking-guards.ts", "utf8");
  const migration = readFileSync("supabase/migrations/0050_admin_availability_override.sql", "utf8");

  assert.match(actions, /allowUnavailable: z\.boolean\(\)\.optional\(\)/);
  assert.match(actions, /p_allow_unavailable: allowUnavailable/);
  assert.match(guards, /if \(!insideHours && !input\.allowUnavailable\)/);
  assert.match(guards, /if \(blocked && !input\.allowUnavailable\)/);
  // Overlap protection is never waived.
  assert.match(guards, /if \(conflict\) \{\s*return \{ ok: false, reason: "conflict" \};/);

  assert.match(migration, /add column availability_override boolean not null default false/);
  assert.match(migration, /if new\.availability_override then return new; end if;/);
  assert.match(migration, /new\.availability_override := false;/);
  assert.match(migration, /or public\.has_confirmed_appointment_overlap\(v_barber_id, p_start, v_end\)/);
  assert.match(migration, /v_outside_hours or v_blocked\s*\) returning id into v_appointment_id/);
  assert.equal((migration.match(/and not (a\.)?availability_override/g) ?? []).length, 2);
  assert.match(migration, /grant execute on function public\.admin_create_booking_priced\(uuid, text, uuid, timestamptz, integer, boolean, text, boolean\)\s*to service_role/);
  assert.match(migration, /revoke all on function public\.admin_create_booking\(uuid, text, uuid, timestamptz, text, boolean\)\s*from public, anon, authenticated/);
});

test("hour gridlines stay visible above closed-time shading", () => {
  assert.match(calendar, /"pointer-events-none relative z-1 border-t"/);
  assert.match(calendar, /kind === "blocked"\s*\?\s*"border-red-200\/70 dark:border-red-500\/20"\s*:\s*kind === "closed"\s*\?\s*"border-foreground\/10"/);
});

test("closed time follows opening hours in grey while blocked time stays red", () => {
  // Partial bands: closed hours grey, blocks red and painted last.
  assert.match(calendar, /period\.kind === "blocked"\s*\?\s*"bg-red-50 dark:bg-red-500\/15"\s*:\s*"bg-foreground\/6"/);
  assert.match(calendar, /\.sort\(\(a, b\) => \(a\.kind === b\.kind \? 0 : a\.kind === "closed" \? -1 : 1\)\)/);
  // Whole closed weekday: grey header, column and month cell.
  assert.match(calendar, /dayOff === "closed"\s*\?\s*"bg-muted text-muted-foreground"/);
  assert.match(calendar, /dayOff === "closed" \? \(\s*<div aria-hidden className="pointer-events-none absolute inset-0 bg-foreground\/6" \/>/);
  assert.match(calendar, /modifiers\.closed && !modifiers\.past && "bg-foreground\/6 text-muted-foreground"/);
});
