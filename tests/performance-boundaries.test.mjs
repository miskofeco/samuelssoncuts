import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const data = readFileSync("src/server/dashboard-data.ts", "utf8");
const pricing = readFileSync("src/server/booking-pricing.ts", "utf8");
const guards = readFileSync("src/server/booking-guards.ts", "utf8");
const migration = readFileSync("supabase/migrations/0036_bounded_availability.sql", "utf8");
const realtime = readFileSync("src/hooks/use-realtime-badge.ts", "utf8");
const notifications = readFileSync("src/server/notifications.ts", "utf8");
const calendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const appointmentActions = readFileSync("src/components/client/confirmed-appointment-actions.tsx", "utf8");
const badgeSync = readFileSync("src/components/shared/push-badge-sync.tsx", "utf8");

test("booking availability is bounded to the client booking window in SQL", () => {
  const booking = data.slice(data.indexOf("export async function loadBookingData"), data.indexOf("export async function loadAdminOverview"));
  assert.match(booking, /confirmed_appointment_slots_window/);
  assert.match(booking, /latestClientBookingDate\(\)/);
  assert.match(booking, /loadBlockedDays\(/);
  assert.doesNotMatch(booking, /rpc\("confirmed_appointment_slots"\)/);
  assert.match(migration, /a\.starts_at < p_to/);
  assert.match(migration, /a\.ends_at > p_from/);
  assert.match(migration, /barber\.is_shop_barber/);
});

test("server-side slot quote fetches only one day and parallelizes independent reads", () => {
  assert.match(pricing, /confirmed_appointment_slots_window/);
  assert.match(pricing, /Promise\.all\(/);
  assert.doesNotMatch(pricing, /rpc\("confirmed_appointment_slots"\)/);
});

test("availability guards check independent constraints concurrently", () => {
  const guard = guards.slice(guards.indexOf("export async function guardSlot"));
  assert.match(guard, /Promise\.all\(/);
  assert.match(guard, /reason: "outside-hours"/);
  assert.match(guard, /reason: "blocked"/);
  assert.match(guard, /reason: "conflict"/);
});

test("admin realtime badge updates do not refresh the entire route", () => {
  assert.match(realtime, /\/api\/admin\/attention/);
  assert.doesNotMatch(realtime, /router\.refresh\(\)/);
  assert.match(realtime, /admin-attention-/);
});

test("in-app notifications persist before push delivery is deferred", () => {
  const insert = notifications.slice(notifications.indexOf("export async function createNotification"), notifications.indexOf("export async function createAdminNotification"));
  assert.match(insert, /after\(/);
  assert.match(insert, /await supabase[\s\S]*?\.from\("notifications"\)/);
});

test("admin calendar defers modal bundles and indexes repeated lookups", () => {
  assert.match(calendar, /dynamic\(/);
  assert.match(calendar, /addOpened \? \(\s*<AddBookingModal/);
  assert.match(calendar, /detailOpened \? \(\s*<AppointmentDetailModal/);
  assert.match(calendar, /clientsById/);
  assert.doesNotMatch(calendar, /clients\.find\(/);
});

test("reservation reschedule picker loads only after opening", () => {
  assert.match(appointmentActions, /dynamic\(/);
  assert.match(appointmentActions, /pickerOpened \? \(\s*<SlotPicker/);
});

test("PWA badge follows live attention counts without re-registering its worker", () => {
  assert.match(badgeSync, /useLiveAttention\(counts\)/);
  assert.match(badgeSync, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(badgeSync, /\}, \[\]\);/);
});
