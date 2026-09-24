import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/admin/add-booking-modal.tsx", "utf8");
const calendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const types = readFileSync("src/lib/database.types.ts", "utf8");

test("manual booking offers an editable price seeded from client slot pricing", () => {
  assert.match(calendar, /<AddBookingModal[\s\S]*pricingSettings=\{pricingSettings\}/);
  assert.match(modal, /isPreferredClientStart\(/);
  assert.match(modal, /priceKindForSlot\(/);
  assert.match(modal, /priceCentsForSlot\(/);
  assert.match(modal, /priceCents: enteredPriceCents/);
  assert.match(modal, /setPriceInput\(null\)/);
  // The service dropdown shows the price that applies on the chosen day.
  assert.match(modal, /isSundayDate\(date\) \? option\.sundayPrice : option\.price/);
});

test("server validates the barber's price and persists it in one admin-only booking RPC", () => {
  assert.match(actions, /priceCents: z\.number\(\)\.int\(\)\.min\(0\)\.max\(1_000_000\)\.multipleOf\(100\)/);
  assert.match(actions, /quoteAdminSlot\(/);
  assert.match(actions, /rpc\("admin_create_booking_priced"/);
  assert.match(actions, /p_price_cents: parsed\.data\.priceCents/);
  assert.match(actions, /p_surcharge: quote\.priceCents === parsed\.data\.priceCents && quote\.surcharge/);
  assert.match(types, /admin_create_booking_priced:/);
});

test("priced booking RPC snapshots the override on both appointment and request", () => {
  const migration = readFileSync("supabase/migrations/0046_manual_booking_prices.sql", "utf8");
  assert.match(migration, /create function public\.admin_create_booking_priced/);
  assert.match(migration, /public\.admin_create_booking\(/);
  assert.match(migration, /update public\.appointments[\s\S]*price_cents = p_price_cents/);
  assert.match(migration, /update public\.booking_requests[\s\S]*price_cents = p_price_cents/);
  assert.match(migration, /revoke all on function public\.admin_create_booking_priced[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_create_booking_priced[\s\S]*to service_role/);
});
