// Pure date math (no imports) so the Node test runner can load it directly.

/** yyyy-mm-dd bounds [fromDate, toDate) covering the month around `date` plus one month either side. */
export function adminCalendarWindowDates(date: string, today: string) {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const [year, month] = anchor.slice(0, 7).split("-").map(Number);
  const first = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10);
  return { fromDate: first(-1), toDate: first(2) };
}

/** Whether every day of the next view is already present in the loaded window. */
export function calendarWindowCovers(
  view: "day" | "week" | "month",
  date: string,
  window: { fromDate: string; toDate: string },
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (view === "day") return date >= window.fromDate && date < window.toDate;
  if (view === "month") {
    // The month grid also renders days from the preceding and following months.
    const [year, month] = date.slice(0, 7).split("-").map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
    const afterNext = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);
    return previous >= window.fromDate && afterNext <= window.toDate;
  }

  const day = new Date(`${date}T12:00:00Z`);
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - mondayOffset);
  const monday = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 6);
  const sunday = day.toISOString().slice(0, 10);
  return monday >= window.fromDate && sunday < window.toDate;
}
