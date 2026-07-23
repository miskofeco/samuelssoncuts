import type { Appointment, BookingRequest, ClientProfile, Service } from "./types";

// Labels are passed in by the caller so charts can be localized. `locale` drives
// month names; `weekdayLabels`/`statusLabels` come from the active dictionary.
type StatusLabels = { new: string; proposed: string; confirmed: string; closed: string };
export type TrendDirection = "up" | "down" | "flat";
export type PercentageTrend = { direction: TrendDirection; percent: number };
export type AdminOverviewMetricTrends = {
  todayAppointments: PercentageTrend;
  todayRevenue: PercentageTrend;
  revenueThisMonth: PercentageTrend;
  pendingApprovals: PercentageTrend;
  openRequests: PercentageTrend;
  awaitingClient: PercentageTrend;
};

function shiftIsoDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const value = new Date(year, month - 1 + delta, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function isInIsoRange(date: string | undefined, start: string, end: string): boolean {
  if (!date) return false;
  const iso = date.slice(0, 10);
  return iso >= start && iso <= end;
}

export function percentageTrend(current: number, previous: number): PercentageTrend {
  if (current === previous) return { direction: "flat", percent: 0 };
  const direction: TrendDirection = current > previous ? "up" : "down";
  if (previous === 0) return { direction, percent: 100 };
  return { direction, percent: Math.round((Math.abs(current - previous) / previous) * 100) };
}

// ---------------------------------------------------------------------------
// Revenue — money is never stored on `appointments`. It lives on the
// originating booking_requests.price_cents (which already bakes in the +10%
// gap surcharge). Walk-ins have no request, so fall back to the service's list
// price. `outcome` of cancelled/no_show earns nothing. This helper is the
// single source of truth for every money figure in the admin UI.
// ---------------------------------------------------------------------------

/** Euros→cents for the service list price (Service.price is whole euros). */
function serviceListCents(serviceId: string, servicesById: Map<string, Service>): number {
  const service = servicesById.get(serviceId);
  return service ? Math.round(service.price * 100) : 0;
}

/**
 * Realised revenue for one appointment, in cents. Cancelled/no-show → 0.
 * Prefers the linked request's captured price (includes surcharge); otherwise
 * the current service list price (covers walk-ins and legacy rows).
 */
export function appointmentRevenueCents(
  appointment: Appointment,
  requestsById: Map<string, BookingRequest>,
  servicesById: Map<string, Service>,
): number {
  if (appointment.outcome === "cancelled" || appointment.outcome === "no_show") {
    return 0;
  }
  const request = appointment.requestId
    ? requestsById.get(appointment.requestId)
    : undefined;
  if (request && typeof request.priceCents === "number") {
    return request.priceCents;
  }
  return serviceListCents(appointment.serviceId, servicesById);
}

/** Convenience: build the lookup maps the revenue helper needs. */
export function revenueLookups(requests: BookingRequest[], services: Service[]) {
  return {
    requestsById: new Map(requests.map((r) => [r.id, r])),
    servicesById: new Map(services.map((s) => [s.id, s])),
  };
}

/** Total realised revenue (cents) across the given appointments. */
export function totalRevenueCents(
  appointments: Appointment[],
  requests: BookingRequest[],
  services: Service[],
): number {
  const { requestsById, servicesById } = revenueLookups(requests, services);
  return appointments.reduce(
    (sum, a) => sum + appointmentRevenueCents(a, requestsById, servicesById),
    0,
  );
}

export function adminOverviewMetricTrends({
  appointments,
  requests,
  services,
  clients,
  today,
}: {
  appointments: Appointment[];
  requests: BookingRequest[];
  services: Service[];
  clients: ClientProfile[];
  today: string;
}): AdminOverviewMetricTrends {
  const { requestsById, servicesById } = revenueLookups(requests, services);
  const yesterday = shiftIsoDate(today, -1);
  const monthKey = today.slice(0, 7);
  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const currentWindowStart = shiftIsoDate(today, -29);
  const previousWindowStart = shiftIsoDate(today, -59);
  const previousWindowEnd = shiftIsoDate(today, -30);

  const todays = appointments.filter((a) => a.date === today);
  const yesterdays = appointments.filter((a) => a.date === yesterday);
  const currentMonthAppointments = appointments.filter((a) => a.date.slice(0, 7) === monthKey);
  const previousMonthAppointments = appointments.filter(
    (a) => a.date.slice(0, 7) === previousMonthKey,
  );
  const appointmentRevenue = (items: Appointment[]) =>
    items.reduce(
      (sum, a) => sum + appointmentRevenueCents(a, requestsById, servicesById),
      0,
    );
  const pendingClientInflow = (start: string, end: string) =>
    clients.filter(
      (c) =>
        c.role !== "admin" &&
        c.status === "pending" &&
        c.emailConfirmed &&
        isInIsoRange(c.createdAt, start, end),
    ).length;
  const requestInflow = (status: BookingRequest["status"], start: string, end: string) =>
    requests.filter((r) => r.status === status && isInIsoRange(r.createdAt, start, end)).length;

  return {
    todayAppointments: percentageTrend(todays.length, yesterdays.length),
    todayRevenue: percentageTrend(appointmentRevenue(todays), appointmentRevenue(yesterdays)),
    revenueThisMonth: percentageTrend(
      appointmentRevenue(currentMonthAppointments),
      appointmentRevenue(previousMonthAppointments),
    ),
    pendingApprovals: percentageTrend(
      pendingClientInflow(currentWindowStart, today),
      pendingClientInflow(previousWindowStart, previousWindowEnd),
    ),
    openRequests: percentageTrend(
      requestInflow("pending", currentWindowStart, today),
      requestInflow("pending", previousWindowStart, previousWindowEnd),
    ),
    awaitingClient: percentageTrend(
      requestInflow("proposed", currentWindowStart, today),
      requestInflow("proposed", previousWindowStart, previousWindowEnd),
    ),
  };
}

/** Revenue (in euros, rounded) per month for the last `months` months. */
export function revenueTrend(
  appointments: Appointment[],
  requests: BookingRequest[],
  services: Service[],
  months = 6,
  locale = "en-US",
) {
  const { requestsById, servicesById } = revenueLookups(requests, services);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  const buckets: { key: string; label: string; revenue: number }[] = [];
  const now = new Date();
  now.setDate(1);

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: monthFormatter.format(d), revenue: 0 });
  }

  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const appointment of appointments) {
    const bucket = index.get(appointment.date.slice(0, 7));
    if (bucket) {
      bucket.revenue += appointmentRevenueCents(appointment, requestsById, servicesById);
    }
  }

  return buckets.map(({ label, revenue }) => ({ label, revenue: Math.round(revenue / 100) }));
}

/** Revenue (euros) grouped by service, highest first — drops zero-revenue services. */
export function revenueByService(
  appointments: Appointment[],
  requests: BookingRequest[],
  services: Service[],
) {
  const { requestsById, servicesById } = revenueLookups(requests, services);
  const totals = new Map<string, number>();
  for (const appointment of appointments) {
    const cents = appointmentRevenueCents(appointment, requestsById, servicesById);
    if (cents <= 0) continue;
    totals.set(appointment.serviceId, (totals.get(appointment.serviceId) ?? 0) + cents);
  }
  return [...totals.entries()]
    .map(([serviceId, cents]) => ({
      label: servicesById.get(serviceId)?.name ?? "—",
      revenue: Math.round(cents / 100),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Outcomes — `appointment.outcome` (completed / no_show / cancelled) is captured
// on every past appointment but never surfaced. These summarise reliability.
// ---------------------------------------------------------------------------

export type OutcomeSummary = {
  completed: number;
  noShow: number;
  cancelled: number;
  /** Appointments with an outcome recorded (the denominator for rates). */
  recorded: number;
  /** no_show / (completed + no_show), 0–1; ignores cancelled. 0 when no basis. */
  noShowRate: number;
};

/** Tally outcomes across appointments. */
export function outcomeSummary(appointments: Appointment[]): OutcomeSummary {
  let completed = 0;
  let noShow = 0;
  let cancelled = 0;
  for (const a of appointments) {
    if (a.outcome === "completed") completed += 1;
    else if (a.outcome === "no_show") noShow += 1;
    else if (a.outcome === "cancelled") cancelled += 1;
  }
  const attended = completed + noShow;
  return {
    completed,
    noShow,
    cancelled,
    recorded: completed + noShow + cancelled,
    noShowRate: attended > 0 ? noShow / attended : 0,
  };
}

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
