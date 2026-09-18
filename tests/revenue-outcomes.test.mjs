import assert from "node:assert/strict";
import test from "node:test";

import {
  appointmentsInAnalyticsPeriod,
  appointmentRevenueCents,
  adminOverviewMetricTrends,
  outcomeSummary,
  percentageTrend,
  requestsInAnalyticsPeriod,
  revenueByService,
  revenueLookups,
  revenueTrend,
  totalRevenueCents,
} from "../src/domain/analytics.ts";

const services = [
  { id: "svc-cut", name: "Haircut", duration: 30, price: 20 },
  { id: "svc-beard", name: "Beard", duration: 15, price: 10 },
];

// A request with a captured price (includes surcharge) — 2200c = 22 €.
const requests = [
  { id: "req-1", clientId: "c1", serviceId: "svc-cut", note: "", preferences: [], status: "confirmed", createdAt: "2026-06-01", priceCents: 2200 },
];

function appt(over) {
  return {
    id: "a",
    requestId: null,
    clientId: "c1",
    serviceId: "svc-cut",
    date: "2026-06-15",
    time: "10:00",
    outcome: null,
    ...over,
  };
}

test("appointmentRevenueCents prefers the linked request price", () => {
  const { requestsById, servicesById } = revenueLookups(requests, services);
  const a = appt({ requestId: "req-1" });
  assert.equal(appointmentRevenueCents(a, requestsById, servicesById), 2200);
});

test("appointmentRevenueCents falls back to service list price for walk-ins", () => {
  const { requestsById, servicesById } = revenueLookups(requests, services);
  const a = appt({ requestId: null, serviceId: "svc-beard" });
  assert.equal(appointmentRevenueCents(a, requestsById, servicesById), 1000);
});

test("cancelled and no-show appointments earn nothing", () => {
  const { requestsById, servicesById } = revenueLookups(requests, services);
  assert.equal(
    appointmentRevenueCents(appt({ requestId: "req-1", outcome: "cancelled" }), requestsById, servicesById),
    0,
  );
  assert.equal(
    appointmentRevenueCents(appt({ requestId: "req-1", outcome: "no_show" }), requestsById, servicesById),
    0,
  );
});

test("totalRevenueCents sums realised revenue only", () => {
  const appts = [
    appt({ id: "a1", requestId: "req-1" }),          // 2200
    appt({ id: "a2", serviceId: "svc-beard" }),      // 1000 (fallback)
    appt({ id: "a3", requestId: "req-1", outcome: "no_show" }), // 0
  ];
  assert.equal(totalRevenueCents(appts, requests, services), 3200);
});

test("revenueByService groups euros highest-first and drops zeroes", () => {
  const appts = [
    appt({ id: "a1", requestId: "req-1" }),          // Haircut 22 €
    appt({ id: "a2", serviceId: "svc-beard" }),      // Beard 10 €
    appt({ id: "a3", serviceId: "svc-beard", outcome: "cancelled" }), // 0
  ];
  const rows = revenueByService(appts, requests, services);
  assert.deepEqual(rows, [
    { label: "Haircut", revenue: 22 },
    { label: "Beard", revenue: 10 },
  ]);
});

test("revenueTrend returns a bucket per month with euro totals", () => {
  const rows = revenueTrend([], requests, services, 6, "en-US");
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => typeof r.revenue === "number" && typeof r.label === "string"));
});

test("outcomeSummary tallies and computes no-show rate ignoring cancellations", () => {
  const s = outcomeSummary([
    appt({ outcome: "completed" }),
    appt({ outcome: "completed" }),
    appt({ outcome: "no_show" }),
    appt({ outcome: "cancelled" }),
    appt({ outcome: null }),
  ]);
  assert.equal(s.completed, 2);
  assert.equal(s.noShow, 1);
  assert.equal(s.cancelled, 1);
  assert.equal(s.recorded, 4);
  // 1 no-show / (2 completed + 1 no-show) = 1/3
  assert.ok(Math.abs(s.noShowRate - 1 / 3) < 1e-9);
});

test("outcomeSummary reports zero rate when nothing attended", () => {
  const s = outcomeSummary([appt({ outcome: "cancelled" }), appt({ outcome: null })]);
  assert.equal(s.noShowRate, 0);
});

test("percentageTrend returns direction and whole percent change", () => {
  assert.deepEqual(percentageTrend(12, 10), { direction: "up", percent: 20 });
  assert.deepEqual(percentageTrend(8, 10), { direction: "down", percent: 20 });
  assert.deepEqual(percentageTrend(10, 10), { direction: "flat", percent: 0 });
  assert.deepEqual(percentageTrend(3, 0), { direction: "up", percent: 100 });
  assert.deepEqual(percentageTrend(0, 0), { direction: "flat", percent: 0 });
});

test("appointmentsInAnalyticsPeriod uses whole calendar months and excludes future dates", () => {
  const rows = appointmentsInAnalyticsPeriod(
    [
      appt({ id: "before-window", date: "2026-02-28" }),
      appt({ id: "window-start", date: "2026-03-01" }),
      appt({ id: "today", date: "2026-08-18" }),
      appt({ id: "future", date: "2026-08-19" }),
    ],
    6,
    "2026-08-18",
  );

  assert.deepEqual(rows.map((row) => row.id), ["window-start", "today"]);
});

test("requestsInAnalyticsPeriod compares request creation dates in the same window", () => {
  const rows = requestsInAnalyticsPeriod(
    [
      { ...requests[0], id: "before-window", createdAt: "2026-02-28T23:59:59Z" },
      { ...requests[0], id: "window-start", createdAt: "2026-03-01T00:00:00Z" },
      { ...requests[0], id: "today", createdAt: "2026-08-18T16:00:00Z" },
      { ...requests[0], id: "future", createdAt: "2026-08-19T00:00:00Z" },
    ],
    6,
    "2026-08-18",
  );

  assert.deepEqual(rows.map((row) => row.id), ["window-start", "today"]);
});

test("adminOverviewMetricTrends compares current metrics with previous periods", () => {
  const clients = [
    {
      id: "c-new",
      name: "New Pending",
      email: "new@example.com",
      phone: "",
      status: "pending",
      role: "client",
      emailConfirmed: true,
      createdAt: "2026-06-25",
    },
    {
      id: "c-old",
      name: "Old Pending",
      email: "old@example.com",
      phone: "",
      status: "pending",
      role: "client",
      emailConfirmed: true,
      createdAt: "2026-05-25",
    },
  ];
  const trendRequests = [
    {
      id: "r-new",
      clientId: "c-new",
      serviceId: "svc-cut",
      note: "",
      preferences: [],
      status: "pending",
      createdAt: "2026-06-25",
      priceCents: 2000,
    },
    {
      id: "r-old",
      clientId: "c-old",
      serviceId: "svc-cut",
      note: "",
      preferences: [],
      status: "pending",
      createdAt: "2026-05-25",
      priceCents: 2000,
    },
    {
      id: "r-awaiting-new",
      clientId: "c-new",
      serviceId: "svc-cut",
      note: "",
      preferences: [],
      status: "proposed",
      createdAt: "2026-07-01",
      priceCents: 2000,
    },
  ];
  const trendAppointments = [
    appt({ id: "today-1", date: "2026-07-23", requestId: "r-new" }),
    appt({ id: "today-2", date: "2026-07-23", requestId: "r-new" }),
    appt({ id: "yesterday-1", date: "2026-07-22", requestId: "r-old" }),
    appt({ id: "month-1", date: "2026-07-05", requestId: "r-new" }),
    appt({ id: "prev-month-1", date: "2026-06-05", requestId: "r-old" }),
    appt({ id: "prev-month-2", date: "2026-06-06", requestId: "r-old" }),
  ];

  const trends = adminOverviewMetricTrends({
    appointments: trendAppointments,
    requests: trendRequests,
    services,
    clients,
    today: "2026-07-23",
  });

  assert.deepEqual(trends.todayAppointments, { direction: "up", percent: 100 });
  assert.deepEqual(trends.todayRevenue, { direction: "up", percent: 100 });
  assert.deepEqual(trends.revenueThisMonth, { direction: "up", percent: 100 });
  assert.deepEqual(trends.pendingApprovals, { direction: "flat", percent: 0 });
  assert.deepEqual(trends.openRequests, { direction: "flat", percent: 0 });
  assert.deepEqual(trends.awaitingClient, { direction: "up", percent: 100 });
});
