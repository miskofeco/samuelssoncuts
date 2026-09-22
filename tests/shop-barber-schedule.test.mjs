import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("client booking reads the designated barber's hours and validates against the same owner", () => {
  const data = read("src/server/dashboard-data.ts");
  const guards = read("src/server/booking-guards.ts");
  const owner = read("src/server/shop-barber.ts");

  assert.match(owner, /\.eq\("is_shop_barber", true\)/);
  assert.match(data, /loadBookingData[\s\S]*loadBusinessHours\(\)/);
  assert.match(data, /loadBusinessHours\(barberId\?: string\)[\s\S]*\.eq\("barber_id", shopBarberId\)/);
  assert.match(guards, /input\.barberId \?\? await getShopBarberId\(\)/);
});

test("admin availability displays and saves the designated barber's schedule", () => {
  const page = read("src/app/admin/availability/page.tsx");
  const actions = read("src/app/actions.ts");

  assert.match(page, /loadBusinessHours\(\)/);
  assert.match(actions, /saveBusinessHoursAction[\s\S]*const barberId = await getShopBarberId\(\)[\s\S]*barber_id: barberId/);
  assert.match(actions, /saveBusinessHoursAction[\s\S]*getSupabaseAdminClient\(\)[\s\S]*\.from\("business_hours"\)/);
});

test("new bookings and database functions are restricted to the designated barber", () => {
  const actions = read("src/app/actions.ts");
  const migration = read("supabase/migrations/0033_single_shop_barber.sql");

  assert.match(actions, /confirmRequestAction[\s\S]*p_barber_id: await getShopBarberId\(\)/);
  assert.match(actions, /createAdminBookingAction[\s\S]*barber_id: await getShopBarberId\(\)/);
  assert.match(migration, /create unique index if not exists profiles_one_shop_barber/);
  assert.match(migration, /p_barber_id[\s\S]*is_shop_barber/);
  assert.match(migration, /confirmed_appointment_slots\(\)[\s\S]*barber\.is_shop_barber/);
});

test("admin and client rescheduling retain the designated barber", () => {
  const migration = read("supabase/migrations/0034_shop_barber_rescheduling.sql");
  assert.match(migration, /create or replace function public\.admin_reschedule_appointment_to_proposal[\s\S]*select id into v_shop_barber_id[\s\S]*is_shop_barber[\s\S]*values \(v_appt\.request_id, v_shop_barber_id/);
  assert.match(migration, /create or replace function public\.client_request_reschedule[\s\S]*select id into v_shop_barber_id[\s\S]*is_shop_barber[\s\S]*has_confirmed_appointment_overlap\(v_shop_barber_id/);
});

test("future legacy appointments move to the shop barber without rewriting history", () => {
  const migration = read("supabase/migrations/0035_future_shop_appointments.sql");
  assert.match(migration, /update public\.appointments[\s\S]*set barber_id = v_shop_barber_id[\s\S]*status = 'confirmed'[\s\S]*starts_at > now\(\)/);
  assert.match(migration, /has_confirmed_appointment_overlap/);
});
