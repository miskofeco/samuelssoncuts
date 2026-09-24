import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import test from "node:test";

const schedule = readFileSync("src/domain/schedule.ts", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const slotPicker = readFileSync("src/components/client/slot-picker.tsx", "utf8");
const requestForm = readFileSync("src/components/client/request-form.tsx", "utf8");
const bookingPricing = readFileSync("src/server/booking-pricing.ts", "utf8");

test("VIP pricing starts at 17:00, defaults to 20 percent, and overrides gap pricing", () => {
  assert.match(schedule, /export const DEFAULT_VIP_SURCHARGE_PERCENT = 20/);
  assert.match(schedule, /export const VIP_START_MINUTES = 17 \* 60/);
  assert.match(schedule, /export function isVipStart/);
  assert.match(schedule, /isVipStart\(options\.startsAt\)/);
  assert.match(schedule, /vipSurchargePercent/);
  assert.match(schedule, /gapSurchargePercent/);
  assert.match(schedule, /return wholeEuroCents\(\(wholeBaseCents \* \(100 \+ surchargePercent\)\) \/ 100\)/);
  assert.match(actions, /quoteClientSlot/);
  assert.match(bookingPricing, /priceCentsForSlot\(basePriceCents, preferred,[\s\S]*startsAt: input\.time/);
});

test("VIP starts override best-price connecting slots in the client and server quotes", () => {
  assert.match(schedule, /export function priceKindForSlot/);
  assert.match(schedule, /if \(options\.startsAt && isVipStart\(options\.startsAt\)\) return "vip";\s*if \(preferred\) return "base"/);
  assert.match(bookingPricing, /priceKindForSlot\(preferred, \{ startsAt: input\.time \}\) !== "base"/);
});

test("Sunday bookings quote from the service's Sunday price on client and server", () => {
  const migration = readFileSync("supabase/migrations/0048_sunday_service_prices.sql", "utf8");
  const serviceManager = readFileSync("src/components/admin/service-manager.tsx", "utf8");

  assert.match(migration, /add column sunday_price_cents integer/);
  assert.match(migration, /set sunday_price_cents = price_cents/);
  assert.match(migration, /alter column sunday_price_cents set not null/);
  assert.match(bookingPricing, /isSundayDate\(input\.date\) \? input\.sundayPriceCents : input\.basePriceCents/);
  // Every server quote caller passes the Sunday price alongside the regular one.
  assert.equal(
    (actions.match(/basePriceCents: \w+\.price_cents,\s*sundayPriceCents: \w+\.sunday_price_cents/g) ?? []).length,
    3,
  );
  assert.match(actions, /sundayPriceCents: z\.number\(\)\.int\(\)\.min\(0\)\.max\(1_000_000\)/);
  assert.match(actions, /sunday_price_cents: parsed\.data\.sundayPriceCents/);
  assert.match(slotPicker, /priceForSlot\(servicePriceForDate\(service, date\), preferred/);
  assert.match(requestForm, /const basePrice = servicePriceForDate\(service, date\)/);
  assert.match(serviceManager, /label=\{t\.admin\.serviceSundayPrice\}/);
});

test("catalog and manual prices are whole euros end to end", () => {
  const migration = readFileSync("supabase/migrations/0049_whole_euro_service_prices.sql", "utf8");
  const serviceManager = readFileSync("src/components/admin/service-manager.tsx", "utf8");

  assert.match(migration, /set price_cents = round\(price_cents \/ 100\.0\) \* 100/);
  assert.match(migration, /sunday_price_cents = round\(sunday_price_cents \/ 100\.0\) \* 100/);
  assert.match(migration, /check \(price_cents % 100 = 0\)/);
  assert.match(migration, /check \(sunday_price_cents % 100 = 0\)/);
  assert.equal((actions.match(/PriceCents: z\.number\(\)\.int\(\)\.min\(0\)\.max\(1_000_000\)\.multipleOf\(100\)/g) ?? []).length, 1);
  assert.equal((actions.match(/priceCents: z\.number\(\)\.int\(\)\.min\(0\)\.max\(1_000_000\)\.multipleOf\(100\)/g) ?? []).length, 2);
  assert.doesNotMatch(serviceManager, /step=\{0\.5\}/);
});

test("barber can manage pricing surcharges from admin settings", () => {
  const settingsPage = readFileSync("src/app/admin/settings/page.tsx", "utf8");
  assert.equal(existsSync("supabase/migrations/0023_pricing_settings.sql"), true);
  const migration = readFileSync("supabase/migrations/0023_pricing_settings.sql", "utf8");

  assert.match(migration, /create table public\.pricing_settings/);
  assert.match(migration, /gap_surcharge_percent integer not null default 10/);
  assert.match(migration, /vip_surcharge_percent integer not null default 20/);
  assert.match(actions, /export async function savePricingSettingsAction/);
  assert.match(settingsPage, /PricingSettingsForm/);
});

test("client VIP slots use blue styling and highlighted surcharge text", () => {
  assert.match(slotPicker, /const vipPriceSlot = slot\.priceKind === "vip"/);
  assert.match(slotPicker, /border-sky-600 bg-sky-600/);
  assert.match(slotPicker, /border-sky-500 bg-sky-50 text-sky-950/);
  assert.match(slotPicker, /rounded-full bg-sky-100 px-1\.5 py-0\.5 text-sky-800/);
  assert.match(slotPicker, /bg-sky-500/);
});

test("client checkout price is plain text with a larger final price and calculation", () => {
  assert.doesNotMatch(requestForm, /rounded-xl border border-emerald-200 bg-emerald-50/);
  assert.match(requestForm, /const priceCalculation = slot/);
  assert.match(requestForm, /service\.price/);
  assert.match(requestForm, /pricingSettings\.vipSurchargePercent/);
  assert.match(requestForm, /pricingSettings\.gapSurchargePercent/);
  assert.match(requestForm, /\{t\.client\.youPayPrefix\}:\{" "\}/);
  assert.match(requestForm, /ml-3 text-2xl font-bold/);
  assert.match(requestForm, /\{priceCalculation \? `\(\$\{priceCalculation\}\)` : null\}/);
});

test("client VIP booking warning uses blue notice styling", () => {
  assert.doesNotMatch(requestForm, /bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black/);
  assert.match(requestForm, /bg-sky-50 px-3 py-2 text-sm text-sky-950/);
  assert.match(requestForm, /dark:bg-sky-500\/10 dark:text-sky-200/);
});
