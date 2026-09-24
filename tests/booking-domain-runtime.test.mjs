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

test("quoted prices are rounded to whole euros, halves rounding up", () => {
  assert.equal(schedule.priceCentsForSlot(2000, true, { startsAt: "09:00" }), 2000);
  assert.equal(schedule.priceCentsForSlot(2000, false, { startsAt: "13:00", gapSurchargePercent: 10 }), 2200);
  // 15 € + 10 % = 16.50 € → 17 €; 32 € + 10 % = 35.20 € → 35 €.
  assert.equal(schedule.priceCentsForSlot(1500, false, { startsAt: "13:00", gapSurchargePercent: 10 }), 1700);
  assert.equal(schedule.priceCentsForSlot(3200, false, { startsAt: "13:00", gapSurchargePercent: 10 }), 3500);
  assert.equal(schedule.priceCentsForSlot(3200, false, { startsAt: "17:00", vipSurchargePercent: 20 }), 3800);
  // A legacy fractional catalog price is rounded before the surcharge applies.
  assert.equal(schedule.priceCentsForSlot(2050, true, { startsAt: "09:00" }), 2100);
  assert.equal(schedule.priceForSlot(20.5, false, { startsAt: "13:00", gapSurchargePercent: 10 }), 23);
  assert.equal(schedule.priceForSlot(15, false, { startsAt: "13:00", gapSurchargePercent: 10 }), 17);
});

test("stored prices display without decimals when they are whole euros", () => {
  assert.equal(schedule.formatEuroAmount(2200), "22");
  assert.equal(schedule.formatEuroAmount(0), "0");
  // Legacy snapshots keep their exact cents rather than being silently rewritten.
  assert.equal(schedule.formatEuroAmount(2255), "22.55");
  assert.equal(schedule.formatEuroAmount(2250), "22.50");
});

test("Sunday dates use the service's separate Sunday price", () => {
  const service = { price: 32, sundayPrice: 40 };
  assert.equal(schedule.isSundayDate("2026-10-04"), true);
  assert.equal(schedule.isSundayDate("2026-10-03"), false);
  assert.equal(schedule.isSundayDate("2026-10-05"), false);
  // DST ends on Sunday 2026-10-25 in the shop time zone; the calendar day still counts.
  assert.equal(schedule.isSundayDate("2026-10-25"), true);
  assert.equal(schedule.servicePriceForDate(service, "2026-10-04"), 40);
  assert.equal(schedule.servicePriceForDate(service, "2026-10-05"), 32);
  assert.equal(schedule.servicePriceForDate(service, null), 32);
  // Surcharges apply on top of the Sunday base.
  assert.equal(
    schedule.priceForSlot(schedule.servicePriceForDate(service, "2026-10-04"), false, {
      startsAt: "17:00",
      vipSurchargePercent: 20,
    }),
    48,
  );
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

test("manual euro input accepts whole euros only", () => {
  assert.equal(schedule.parseEuroCents("20"), 2000);
  assert.equal(schedule.parseEuroCents(" 22 "), 2200);
  assert.equal(schedule.parseEuroCents("20.00"), 2000);
  assert.equal(schedule.parseEuroCents("20,0"), 2000);
  assert.equal(schedule.parseEuroCents("0"), 0);
  assert.equal(schedule.parseEuroCents("10000"), 1_000_000);
  assert.equal(schedule.parseEuroCents("20.50"), null);
  assert.equal(schedule.parseEuroCents("20,5"), null);
  assert.equal(schedule.parseEuroCents("-1"), null);
  assert.equal(schedule.parseEuroCents("10001"), null);
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

const weekHours = [
  { weekday: 0, opensAt: "08:00", closesAt: "14:00", closed: false },
  { weekday: 1, opensAt: "09:00", closesAt: "20:00", closed: true },
  { weekday: 3, opensAt: "09:00", closesAt: "20:00", closed: false },
];

test("admin day availability marks hours outside the day's opening window as closed", () => {
  // Sunday 2026-10-04 opens 08:00–14:00.
  const sunday = schedule.dayAvailability("2026-10-04", weekHours, []);
  assert.equal(sunday.closedAllDay, false);
  assert.equal(sunday.opensAt, 8 * 60);
  assert.equal(sunday.closesAt, 14 * 60);
  assert.deepEqual(sunday.closedPeriods, [
    { startMinutes: 0, endMinutes: 8 * 60, kind: "closed" },
    { startMinutes: 14 * 60, endMinutes: 24 * 60, kind: "closed" },
  ]);
  assert.equal(schedule.isMinuteUnavailable(sunday, 13 * 60 + 45), false);
  assert.equal(schedule.isMinuteUnavailable(sunday, 14 * 60), true);
  assert.equal(schedule.isMinuteUnavailable(sunday, 15 * 60 + 45), true);
  assert.equal(schedule.isMinuteUnavailable(sunday, 7 * 60 + 45), true);
});

test("a weekday switched off in business hours is closed all day", () => {
  const monday = schedule.dayAvailability("2026-10-05", weekHours, []);
  assert.equal(monday.closedAllDay, true);
  assert.deepEqual(monday.closedPeriods, [{ startMinutes: 0, endMinutes: 24 * 60, kind: "closed" }]);
});

test("partial blocks become blocked periods in shop-local minutes", () => {
  const blocked = [{ start: iso("2026-10-07", "12:00"), end: iso("2026-10-07", "13:30") }];
  const wednesday = schedule.dayAvailability("2026-10-07", weekHours, blocked);
  assert.equal(wednesday.closedAllDay, false);
  assert.deepEqual(
    wednesday.closedPeriods.filter((period) => period.kind === "blocked"),
    [{ startMinutes: 12 * 60, endMinutes: 13 * 60 + 30, kind: "blocked" }],
  );
  assert.equal(schedule.isMinuteUnavailable(wednesday, 12 * 60 + 15), true);
  assert.equal(schedule.isMinuteUnavailable(wednesday, 13 * 60 + 30), false);
});

test("blocks covering every opening hour close the whole day", () => {
  const blocked = [{ start: iso("2026-10-04", "07:00"), end: iso("2026-10-04", "15:00") }];
  assert.equal(schedule.dayAvailability("2026-10-04", weekHours, blocked).closedAllDay, true);
  // A block spanning several days is clipped to this day.
  const multiDay = [{ start: iso("2026-10-06", "18:00"), end: iso("2026-10-08", "10:00") }];
  const wednesday = schedule.dayAvailability("2026-10-07", weekHours, multiDay);
  assert.equal(wednesday.closedAllDay, true);
  assert.deepEqual(
    wednesday.closedPeriods.filter((period) => period.kind === "blocked"),
    [{ startMinutes: 0, endMinutes: 24 * 60, kind: "blocked" }],
  );
});

test("days without configured hours keep the default shop window", () => {
  const thursday = schedule.dayAvailability("2026-10-08", weekHours, []);
  assert.equal(thursday.closedAllDay, false);
  assert.equal(thursday.opensAt, schedule.OPEN_MINUTES);
  assert.equal(thursday.closesAt, schedule.CLOSE_MINUTES);
});

test("a confirmed override opens closed and blocked admin times but never past or overlapping ones", () => {
  const date = "2026-10-01";
  const hours = [{ weekday: 4, opensAt: "09:00", closesAt: "15:00", closed: false }];
  const blockedIntervals = [{ start: iso(date, "12:00"), end: iso(date, "13:00") }];
  const bookedToday = [{ id: "a", time: "16:00", durationMinutes: 60 }];
  const now = new Date("2026-09-01T10:00:00Z");
  const options = schedule.adminSlotOptions({
    date, durationMinutes: 30, bookedToday, businessHours: hours,
    blockedIntervals, now, allowUnavailable: true,
  });
  const at = (time) => options.find((item) => item.value === time);
  // The full shop window is offered, with the reason kept for display.
  assert.equal(options[0].value, "07:00");
  assert.equal(options.at(-1).value, "20:30");
  assert.equal(at("08:00").disabledReason, null);
  assert.equal(at("08:00").unavailableReason, "closed");
  assert.equal(at("12:00").disabledReason, null);
  assert.equal(at("12:00").unavailableReason, "blocked");
  assert.equal(at("14:45").unavailableReason, "closed"); // runs past 15:00
  assert.equal(at("10:00").unavailableReason, null);
  assert.equal(at("16:15").disabledReason, "conflict");

  // Without the override, the reason is reported but the option stays disabled.
  const regular = schedule.adminSlotOptions({
    date, durationMinutes: 30, bookedToday, businessHours: hours, blockedIntervals, now,
  });
  assert.equal(regular.find((item) => item.value === "12:00").unavailableReason, "blocked");
  assert.equal(regular.find((item) => item.value === "12:00").disabledReason, "blocked");

  // A closed weekday is fully bookable with the override.
  const closed = schedule.adminSlotOptions({
    date, durationMinutes: 30, bookedToday: [],
    businessHours: [{ ...hours[0], closed: true }], now, allowUnavailable: true,
  });
  assert.equal(closed.every((item) => item.disabledReason === null), true);
  assert.equal(closed.every((item) => item.unavailableReason === "closed"), true);
});

test("the kind covering a minute prefers an explicit block over closed hours", () => {
  const blocked = [{ start: iso("2026-10-04", "13:00"), end: iso("2026-10-04", "15:00") }];
  const sunday = schedule.dayAvailability("2026-10-04", weekHours, blocked);
  assert.equal(schedule.unavailableKindAt(sunday, 7 * 60), "closed");
  assert.equal(schedule.unavailableKindAt(sunday, 10 * 60), null);
  assert.equal(schedule.unavailableKindAt(sunday, 13 * 60 + 30), "blocked");
  // 14:30 is both after closing and inside the block: the block wins.
  assert.equal(schedule.unavailableKindAt(sunday, 14 * 60 + 30), "blocked");
  assert.equal(schedule.unavailableKindAt(sunday, 15 * 60), "closed");
});

// Supabase returns timestamptz as "+00:00", not the "…000Z" form toISOString() produces.
const pg = (day, time) => iso(day, time).replace(".000Z", "+00:00");

test("whole-day blocks from the database show dates only, never 00:00 times", () => {
  const multiDay = schedule.blockedRangeFromRow({
    id: "b1", starts_at: pg("2026-09-23", "00:00"), ends_at: pg("2026-09-26", "00:00"), reason: "Dovolenka",
  });
  assert.deepEqual(multiDay, {
    id: "b1", start: "2026-09-23", end: "2026-09-25", startTime: null, endTime: null, reason: "Dovolenka",
  });
  const oneDay = schedule.blockedRangeFromRow({
    id: "b2", starts_at: pg("2026-09-26", "00:00"), ends_at: pg("2026-09-27", "00:00"), reason: null,
  });
  assert.equal(oneDay.startTime, null);
  assert.equal(oneDay.endTime, null);
  assert.equal(schedule.formatBlockedRange(oneDay, "sk-SK").includes("00:00"), false);
  assert.equal(schedule.formatBlockedRange(multiDay, "sk-SK").includes("00:00"), false);

  const slice = schedule.blockedRangeFromRow({
    id: "b3", starts_at: pg("2026-10-07", "12:00"), ends_at: pg("2026-10-07", "13:30"), reason: "Obed",
  });
  assert.deepEqual([slice.start, slice.end, slice.startTime, slice.endTime], ["2026-10-07", "2026-10-07", "12:00", "13:30"]);

  // A block clipped by the loader window starts at the window's shop midnight.
  const clipped = schedule.blockedRangeFromRow(
    { id: "b4", starts_at: pg("2026-09-20", "00:00"), ends_at: pg("2026-10-03", "00:00"), reason: null },
    { fromIso: iso("2026-09-28", "00:00"), toIso: iso("2026-11-01", "00:00") },
  );
  assert.deepEqual([clipped.start, clipped.end, clipped.startTime, clipped.endTime], ["2026-09-28", "2026-10-02", null, null]);
});

test("block reasons are required and short", () => {
  assert.equal(schedule.BLOCK_REASON_MAX_LENGTH, 40);
  assert.equal(schedule.isValidBlockReason("Dovolenka"), true);
  assert.equal(schedule.isValidBlockReason("  Školenie  "), true);
  assert.equal(schedule.isValidBlockReason(""), false);
  assert.equal(schedule.isValidBlockReason(" a "), false);
  assert.equal(schedule.isValidBlockReason("x".repeat(41)), false);
});

test("blocked periods carry their reason for the admin calendar", () => {
  const blocked = [{ start: iso("2026-10-07", "12:00"), end: iso("2026-10-07", "13:00"), reason: "Obed" }];
  const wednesday = schedule.dayAvailability("2026-10-07", weekHours, blocked);
  assert.deepEqual(
    wednesday.closedPeriods.filter((period) => period.kind === "blocked"),
    [{ startMinutes: 12 * 60, endMinutes: 13 * 60, kind: "blocked", reason: "Obed" }],
  );
  assert.deepEqual(schedule.blockReasonsForDate("2026-10-07", blocked), ["Obed"]);
  assert.deepEqual(schedule.blockReasonsForDate("2026-10-08", blocked), []);
});
