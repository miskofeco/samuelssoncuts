import { getShopTimeZone } from "@/lib/env";

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

export function formatInShopTimeZone(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  timeZone = shopTimeZone(),
) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date(iso));
}

export function dateInShopTimeZone(iso: string) {
  const parts = partsFor(new Date(iso), shopTimeZone());
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function timeInShopTimeZone(iso: string) {
  return formatInShopTimeZone(iso, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
