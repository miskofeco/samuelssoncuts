import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

// Run the real TypeScript domain code without a Next server or a database.
function loadTypeScript(filename, cache = new Map()) {
  const absolute = path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const source = readFileSync(absolute, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = new Module(absolute);
  loaded.filename = absolute;
  loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
  cache.set(absolute, loaded);
  loaded.require = (specifier) => {
    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(absolute), specifier);
      return loadTypeScript(`${resolved}.ts`, cache);
    }
    return Module.createRequire(absolute)(specifier);
  };
  loaded._compile(javascript, absolute);
  return loaded.exports;
}

const schedule = loadTypeScript("src/domain/schedule.ts");
const analytics = loadTypeScript("src/domain/analytics.ts");
const { zonedDateTimeToUtcIso } = loadTypeScript("src/lib/time-zone.ts");
const iso = (day, time) => zonedDateTimeToUtcIso(day, time);

test("a lunch block removes only overlapping slots and boundary-touching slots remain free", () => {
  const blocked = [{ start: iso("2026-10-01", "12:00"), end: iso("2026-10-01", "13:00") }];
  assert.equal(schedule.isShopDayFullyBlocked("2026-10-01", blocked), false);
  assert.equal(schedule.isSlotBlocked("2026-10-01", "11:30", 30, blocked), false);
  assert.equal(schedule.isSlotBlocked("2026-10-01", "12:00", 30, blocked), true);
  assert.equal(schedule.isSlotBlocked("2026-10-01", "12:45", 30, blocked), true);
  assert.equal(schedule.isSlotBlocked("2026-10-01", "13:00", 30, blocked), false);
});

test("whole-day blocks follow shop midnights across a DST transition", () => {
  const blocked = [{ start: iso("2026-10-25", "00:00"), end: iso("2026-10-26", "00:00") }];
  assert.equal(schedule.isShopDayFullyBlocked("2026-10-25", blocked), true);
  assert.equal(schedule.isShopDayFullyBlocked("2026-10-26", blocked), false);
});

test("separate touching blocks covering a day count as a full closure", () => {
  const blocked = [
    { start: iso("2026-10-01", "00:00"), end: iso("2026-10-01", "12:00") },
    { start: iso("2026-10-01", "12:00"), end: iso("2026-10-02", "00:00") },
  ];
  assert.equal(schedule.isShopDayFullyBlocked("2026-10-01", blocked), true);
});

test("a partial closure label includes its time range", () => {
  assert.match(schedule.formatBlockedRange({
    id: "block",
    start: "2026-10-01",
    end: "2026-10-01",
    startTime: "12:00",
    endTime: "13:00",
    reason: null,
  }), /12:00–13:00/);
});

test("the final quoted price preserves fractional service euros", () => {
  assert.equal(schedule.priceCentsForSlot(2050, true, { startsAt: "09:00" }), 2050);
  assert.equal(schedule.priceCentsForSlot(2050, false, { startsAt: "13:00", gapSurchargePercent: 10 }), 2255);
  assert.equal(schedule.priceCentsForSlot(2050, false, { startsAt: "17:00", vipSurchargePercent: 20 }), 2460);
  assert.equal(schedule.priceForSlot(20.5, false, { startsAt: "13:00", gapSurchargePercent: 10 }), 22.55);
});

test("VIP pricing overrides a connecting booking from 17:00, including the boundary", () => {
  const settings = { vipSurchargePercent: 25, gapSurchargePercent: 10 };
  const date = "2026-10-01";
  const confirmed = [{ date, time: "18:00", durationMinutes: 60 }];
  assert.equal(schedule.isPreferredClientStart(date, 17 * 60, 60, confirmed), true);
  assert.equal(schedule.isPreferredClientStart(date, 19 * 60, 60, confirmed), true);
  assert.equal(schedule.priceKindForSlot(true, { startsAt: "16:59" }), "base");
  assert.equal(schedule.priceKindForSlot(true, { startsAt: "17:00" }), "vip");
  assert.equal(schedule.priceKindForSlot(true, { startsAt: "19:00" }), "vip");
  assert.equal(schedule.priceKindForSlot(false, { startsAt: "17:00" }), "vip");
  assert.equal(schedule.priceCentsForSlot(2000, true, { startsAt: "17:00", ...settings }), 2500);
  assert.equal(schedule.priceCentsForSlot(2000, true, { startsAt: "19:00", ...settings }), 2500);
  assert.equal(schedule.priceCentsForSlot(2000, false, { startsAt: "17:00", ...settings }), 2500);
  assert.equal(schedule.priceCentsForSlot(2000, true, { startsAt: "16:59", ...settings }), 2000);
});

test("manual booking suggestions follow the same base, gap, and VIP prices as clients", () => {
  const date = "2026-10-01";
  const confirmed = [{ date, time: "11:00", durationMinutes: 60 }];
  const settings = { gapSurchargePercent: 15, vipSurchargePercent: 30 };
  const quote = (time) => {
    const preferred = schedule.isPreferredClientStart(date, schedule.minutesOf(time), 60, confirmed);
    return {
      kind: schedule.priceKindForSlot(preferred, { startsAt: time }),
      priceCents: schedule.priceCentsForSlot(2000, preferred, { startsAt: time, ...settings }),
    };
  };
  assert.deepEqual(quote("10:00"), { kind: "base", priceCents: 2000 });
  assert.deepEqual(quote("13:00"), { kind: "gap", priceCents: 2300 });
  assert.deepEqual(quote("17:00"), { kind: "vip", priceCents: 2600 });
});

test("manual euro input accepts cents and Slovak comma notation exactly", () => {
  assert.equal(schedule.parseEuroCents("20.50"), 2050);
  assert.equal(schedule.parseEuroCents("20,5"), 2050);
  assert.equal(schedule.parseEuroCents("0"), 0);
  assert.equal(schedule.parseEuroCents("10000.00"), 1_000_000);
  assert.equal(schedule.parseEuroCents("20.999"), null);
  assert.equal(schedule.parseEuroCents("-1"), null);
  assert.equal(schedule.parseEuroCents("10000.01"), null);
});

test("revenue summaries preserve captured cents after catalog edits", () => {
  const appointment = {
    id: "manual", requestId: null, clientId: null, serviceId: "cut",
    date: "2026-09-23", time: "10:00", status: "confirmed", priceCents: 2050,
  };
  const currentServices = [{ id: "cut", name: "Cut", duration: 45, price: 30 }];
  assert.equal(analytics.totalRevenueCents([appointment], [], currentServices), 2050);
  assert.deepEqual(analytics.revenueByService([appointment], [], currentServices), [
    { label: "Cut", revenue: 20.5 },
  ]);
  const trend = analytics.revenueTrend([appointment], [], currentServices, 1, "en-US", "2026-09-24");
  assert.equal(trend.reduce((sum, bucket) => sum + bucket.revenue, 0), 20.5);
});

test("missing service IDs never inherit another service's name or duration", () => {
  const known = [{ id: "cut", name: "Haircut", duration: 45, price: 20 }];
  const missing = schedule.serviceById("retired-service", known);
  assert.equal(missing.id, "retired-service");
  assert.notEqual(missing.name, "Haircut");
  assert.equal(missing.duration, 0);
});

test("confirmed reservation display follows the actual appointment after rescheduling", () => {
  const request = { requestedDate: "2026-10-01", requestedTime: "10:00" };
  const staleProposal = { date: "2026-10-03", time: "11:00", status: "accepted" };
  const actual = { date: "2026-10-05", time: "12:00" };
  assert.deepEqual(schedule.bookedSlotForRequest(request, staleProposal, actual), actual);
});

test("admin time options honor configured opening hours and exact blocks", () => {
  const date = "2026-10-01";
  const hours = [{ weekday: 4, opensAt: "09:00", closesAt: "15:00", closed: false }];
  const blockedIntervals = [{ start: iso(date, "12:00"), end: iso(date, "13:00") }];
  const options = schedule.adminSlotOptions({
    date, durationMinutes: 30, bookedToday: [], businessHours: hours,
    blockedIntervals, now: new Date("2026-09-01T10:00:00Z"),
  });
  assert.equal(options[0].value, "09:00");
  assert.equal(options.at(-1).value, "14:30");
  assert.equal(options.find((item) => item.value === "11:30").disabledReason, null);
  assert.equal(options.find((item) => item.value === "12:00").disabledReason, "blocked");
  assert.equal(options.find((item) => item.value === "13:00").disabledReason, null);
});
