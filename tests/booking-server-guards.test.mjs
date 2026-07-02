import assert from "node:assert/strict";
import test from "node:test";

import {
  isSlotInsideBusinessHours,
  slotOverlapsRange,
} from "../src/server/booking-guards.ts";

test("booking guard accepts slots fully contained inside open business hours", () => {
  assert.equal(
    isSlotInsideBusinessHours(
      { closed: false, opensAt: "09:00", closesAt: "17:00" },
      "10:15",
      45,
    ),
    true,
  );
});

test("booking guard rejects closed days and slots that cross opening boundaries", () => {
  assert.equal(
    isSlotInsideBusinessHours(
      { closed: true, opensAt: "09:00", closesAt: "17:00" },
      "10:00",
      30,
    ),
    false,
  );
  assert.equal(
    isSlotInsideBusinessHours(
      { closed: false, opensAt: "09:00", closesAt: "17:00" },
      "08:45",
      30,
    ),
    false,
  );
  assert.equal(
    isSlotInsideBusinessHours(
      { closed: false, opensAt: "09:00", closesAt: "17:00" },
      "16:30",
      45,
    ),
    false,
  );
});

test("booking guard treats date ranges as half-open intervals", () => {
  const range = {
    starts_at: "2026-07-03T10:00:00.000Z",
    ends_at: "2026-07-03T11:00:00.000Z",
  };

  assert.equal(
    slotOverlapsRange("2026-07-03T09:30:00.000Z", "2026-07-03T10:15:00.000Z", range),
    true,
  );
  assert.equal(
    slotOverlapsRange("2026-07-03T11:00:00.000Z", "2026-07-03T11:30:00.000Z", range),
    false,
  );
});
