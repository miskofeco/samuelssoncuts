import assert from "node:assert/strict";
import test from "node:test";

import {
  appointmentRevenueCents,
  outcomeSummary,
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
