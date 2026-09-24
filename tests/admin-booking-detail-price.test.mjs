import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminCalendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const detailModal = readFileSync("src/components/admin/appointment-detail-modal.tsx", "utf8");

test("admin calendar detail uses the captured client booking price when available", () => {
  assert.match(adminCalendar, /const requestsById = new Map\(requests\.map\(\(request\) => \[request\.id, request\]\)\)/);
  assert.match(adminCalendar, /const servicePrice = servicePriceForDate\(service, appointment\.date\)/);
  assert.match(adminCalendar, /const bookedPriceCents = appointment\.priceCents \?\? request\?\.priceCents \?\? Math\.round\(servicePrice \* 100\)/);
  assert.match(adminCalendar, /finalPriceCents: bookedPriceCents/);
});

test("booking detail makes the final booked price prominent", () => {
  assert.match(detailModal, /finalPrice = formatEuroAmount\(item\.finalPriceCents\)/);
  assert.match(detailModal, /\{isConfirmed \? t\.admin\.finalPrice : t\.admin\.requestedPrice\}/);
  assert.match(detailModal, /text-2xl font-semibold/);
});
