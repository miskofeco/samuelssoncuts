// Relative imports keep this module importable from the Node test runner.
import { addDaysToDate, dateInShopTimeZone, shopDayRangeUtc } from "../lib/time-zone";

// The reminder cron runs once a day (vercel.json: 08:00 UTC). It must therefore
// cover every appointment on the NEXT shop-local day, not a narrow "24h from
// now" band that only catches appointments starting around the cron minute.
// Returns half-open UTC bounds [startIso, endIso) of tomorrow in the shop zone.
export function reminderWindowFor(now: Date, timeZone?: string) {
  const todayShop = dateInShopTimeZone(now.toISOString(), timeZone);
  const tomorrowShop = addDaysToDate(todayShop, 1);
  return { date: tomorrowShop, ...shopDayRangeUtc(tomorrowShop, timeZone) };
}
