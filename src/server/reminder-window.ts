// Relative imports keep this module importable from the Node test runner.
import { addDaysToDate, dateInShopTimeZone, shopDayRangeUtc } from "../lib/time-zone";

// A failed send or a booking confirmed after yesterday's run still needs a
// chance today. Include the rest of today and all of tomorrow in shop time;
// the current instant excludes appointments that have already started.
export function reminderWindowFor(now: Date, timeZone?: string) {
  const todayShop = dateInShopTimeZone(now.toISOString(), timeZone);
  const tomorrowShop = addDaysToDate(todayShop, 1);
  return {
    todayShop,
    tomorrowShop,
    startIso: now.toISOString(),
    endIso: shopDayRangeUtc(tomorrowShop, timeZone).endIso,
  };
}
