import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminCalendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const availabilityManager = readFileSync(
  "src/components/admin/availability-manager.tsx",
  "utf8",
);

test("admin month calendar hides event label text on mobile while keeping colored pills", () => {
  assert.match(adminCalendar, /h-2[^"]*sm:h-auto/);
  assert.match(adminCalendar, /sr-only sm:not-sr-only/);
  assert.match(adminCalendar, /hidden sm:block/);
});

test("availability month calendar hides blocked-day label text on mobile while keeping colored pills", () => {
  assert.match(availabilityManager, /h-2[^"]*sm:h-auto/);
  assert.match(availabilityManager, /sr-only sm:not-sr-only/);
});
