// Pure date math (no imports) so the Node test runner can load it directly.

/** yyyy-mm-dd bounds [fromDate, toDate) covering the month around `date` plus one month either side. */
export function adminCalendarWindowDates(date: string, today: string) {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const [year, month] = anchor.slice(0, 7).split("-").map(Number);
  const first = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10);
  return { fromDate: first(-1), toDate: first(2) };
}
