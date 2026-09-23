import assert from "node:assert/strict";
import test from "node:test";

import { calendarPreviewWindow, calendarPreviewPlacement, nearestAlternativeTime } from "../src/domain/calendar-preview.ts";
import { canAdminSuggestAnotherTime } from "../src/domain/request-actionability.ts";

test("request preview centers a four-hour window around the chosen time", () => {
  assert.deepEqual(calendarPreviewWindow("12:30", 30), { start: 600, end: 840 });
  assert.deepEqual(calendarPreviewWindow("19:00", 60), { start: 1020, end: 1260 });
  assert.deepEqual(calendarPreviewWindow("07:00", 60), { start: 420, end: 660 });
});

test("preview clips nearby confirmed bookings to its visible window", () => {
  const window = calendarPreviewWindow("19:00", 60);
  assert.deepEqual(calendarPreviewPlacement("16:30", 60, window), { top: 0, height: 12.5 });
  assert.deepEqual(calendarPreviewPlacement("19:00", 60, window), { top: 50, height: 25 });
  assert.equal(calendarPreviewPlacement("12:00", 60, window), null);
});

test("admins may suggest another time for pending requests and sent proposals", () => {
  assert.equal(canAdminSuggestAnotherTime("pending"), true);
  assert.equal(canAdminSuggestAnotherTime("proposed"), true);
  assert.equal(canAdminSuggestAnotherTime("confirmed"), false);
  assert.equal(canAdminSuggestAnotherTime("declined"), false);
});

test("the alternate-time picker starts near the requested time, never on it", () => {
  const options = ["18:30", "19:00", "19:30", "20:00"];
  assert.equal(nearestAlternativeTime(options, "19:00", () => false), "19:30");
  assert.equal(nearestAlternativeTime(options, "19:00", (hour) => hour === "19:30"), "18:30");
  assert.equal(nearestAlternativeTime(["19:00"], "19:00", () => false), "19:00");
});
