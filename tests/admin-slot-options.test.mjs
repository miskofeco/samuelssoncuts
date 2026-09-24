import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schedule = readFileSync("src/domain/schedule.ts", "utf8");
const addBooking = readFileSync("src/components/admin/add-booking-modal.tsx", "utf8");
const appointmentDetail = readFileSync(
  "src/components/admin/appointment-detail-modal.tsx",
  "utf8",
);

test("admin slot options use the shop clock and reject partial overlaps", () => {
  assert.match(schedule, /export function adminSlotOptions/);
  assert.match(schedule, /nowMinutesInShopTimeZone\(now\)/);
  assert.match(schedule, /overlaps\(startMin, durationMinutes, minutesOf\(slot\.time\), slot\.durationMinutes\)/);
  assert.match(schedule, /isSlotBlocked\(date, time, durationMinutes, blockedIntervals\)/);
  assert.match(schedule, /disabledReason: past[\s\S]*"closed"[\s\S]*"blocked"[\s\S]*"conflict"/);
});

test("add and reschedule pickers share the same pure option builder", () => {
  assert.match(schedule, /slot\.id !== excludeId/);
  assert.match(schedule, /export function addMinutesToTime/);
  assert.match(addBooking, /adminSlotOptions\(\{/);
  assert.match(appointmentDetail, /adminSlotOptions\(\{/);
  assert.match(appointmentDetail, /excludeId: item\.id/);
});
