import type { Appointment, BookingRequest } from "./types";

// Labels are passed in by the caller so charts can be localized. `locale` drives
// month names; `weekdayLabels`/`statusLabels` come from the active dictionary.
type StatusLabels = { new: string; proposed: string; confirmed: string; closed: string };

const DEFAULT_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_STATUS: StatusLabels = {
  new: "New",
  proposed: "Proposed",
  confirmed: "Confirmed",
  closed: "Closed",
};

/** Bookings per month for the last `months` months (oldest → newest). */
export function bookingsTrend(
  appointments: Appointment[],
  months = 6,
  locale = "en-US",
) {
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const buckets: { key: string; label: string; bookings: number }[] = [];
  const now = new Date();
  now.setDate(1);

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: monthFormatter.format(d), bookings: 0 });
  }

  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const appointment of appointments) {
    const bucket = index.get(appointment.date.slice(0, 7));
    if (bucket) bucket.bookings += 1;
  }

  return buckets.map(({ label, bookings }) => ({ label, bookings }));
}

/** Count of requests by status. */
export function requestsByStatus(
  requests: BookingRequest[],
  labels: StatusLabels = DEFAULT_STATUS,
) {
  const counts: Record<string, number> = {
    pending: 0,
    proposed: 0,
    confirmed: 0,
    declined: 0,
  };
  for (const request of requests) {
    counts[request.status] = (counts[request.status] ?? 0) + 1;
  }
  return [
    { label: labels.new, value: counts.pending, key: "pending" },
    { label: labels.proposed, value: counts.proposed, key: "proposed" },
    { label: labels.confirmed, value: counts.confirmed, key: "confirmed" },
    { label: labels.closed, value: counts.declined, key: "declined" },
  ];
}

/** Confirmed bookings grouped by weekday (Mon-first). */
export function bookingsByWeekday(
  appointments: Appointment[],
  weekdayLabels: readonly string[] = DEFAULT_WEEKDAYS,
) {
  const counts = new Array(7).fill(0);
  for (const appointment of appointments) {
    const day = new Date(`${appointment.date}T12:00:00`).getDay();
    const mondayFirst = (day + 6) % 7;
    counts[mondayFirst] += 1;
  }
  return weekdayLabels.map((label, index) => ({ label, bookings: counts[index] }));
}
