import type { Appointment, BookingRequest } from "./types";

const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" });
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Bookings per month for the last `months` months (oldest → newest). */
export function bookingsTrend(appointments: Appointment[], months = 6) {
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
export function requestsByStatus(requests: BookingRequest[]) {
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
    { label: "New", value: counts.pending, key: "pending" },
    { label: "Proposed", value: counts.proposed, key: "proposed" },
    { label: "Confirmed", value: counts.confirmed, key: "confirmed" },
    { label: "Closed", value: counts.declined, key: "declined" },
  ];
}

/** Confirmed bookings grouped by weekday (Mon-first). */
export function bookingsByWeekday(appointments: Appointment[]) {
  const counts = new Array(7).fill(0);
  for (const appointment of appointments) {
    const day = new Date(`${appointment.date}T12:00:00`).getDay();
    const mondayFirst = (day + 6) % 7;
    counts[mondayFirst] += 1;
  }
  return weekdayLabels.map((label, index) => ({ label, bookings: counts[index] }));
}
