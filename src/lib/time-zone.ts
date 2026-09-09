// Relative import keeps this module importable from the Node test runner
// (which cannot resolve the "@/" alias).
import { getShopTimeZone } from "./env";

export const DEFAULT_SHOP_TIME_ZONE = "Europe/Bratislava";

function shopTimeZone() {
  return getShopTimeZone() || DEFAULT_SHOP_TIME_ZONE;
}

function partsFor(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function offsetMsFor(date: Date, timeZone: string) {
  const parts = partsFor(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

export function zonedDateTimeToUtcIso(date: string, time: string, timeZone = shopTimeZone()) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMsFor(new Date(utcMs), timeZone);
  }

  return new Date(utcMs).toISOString();
}

/** Add whole days to a yyyy-mm-dd string without any time-zone drift. */
export function addDaysToDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

/**
 * Half-open UTC bounds [startIso, endIso) of one whole shop-local day. The end
 * is the next day's midnight so DST transitions never shorten or extend it.
 */
export function shopDayRangeUtc(date: string, timeZone = shopTimeZone()) {
  return {
    startIso: zonedDateTimeToUtcIso(date, "00:00", timeZone),
    endIso: zonedDateTimeToUtcIso(addDaysToDate(date, 1), "00:00", timeZone),
  };
}

export function formatInShopTimeZone(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  timeZone = shopTimeZone(),
) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date(iso));
}

export function dateInShopTimeZone(iso: string, timeZone = shopTimeZone()) {
  const parts = partsFor(new Date(iso), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function timeInShopTimeZone(iso: string) {
  return formatInShopTimeZone(iso, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Current wall-clock minutes since midnight in the shop's time zone (client-safe). */
export function nowMinutesInShopTimeZone(now: Date = new Date(), timeZone = shopTimeZone()) {
  const parts = partsFor(now, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** Shop-local milliseconds for a shop-local yyyy-mm-dd + HH:MM (for comparisons with Date.now()). */
export function shopDateTimeToEpochMs(date: string, time: string, timeZone = shopTimeZone()) {
  return new Date(zonedDateTimeToUtcIso(date, time, timeZone)).getTime();
}
