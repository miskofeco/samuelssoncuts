import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { calendarWindowCovers } from "../src/domain/calendar-window.ts";

const window = { fromDate: "2026-08-01", toDate: "2026-11-01" };

test("day and month moves inside a loaded calendar window need no new server page", () => {
  assert.equal(calendarWindowCovers("day", "2026-10-31", window), true);
  assert.equal(calendarWindowCovers("month", "2026-09-01", window), true);
  assert.equal(calendarWindowCovers("month", "2026-10-01", window), false);
  assert.equal(calendarWindowCovers("month", "2026-11-01", window), false);
});

test("week moves fetch a new window when visible days cross its edge", () => {
  assert.equal(calendarWindowCovers("week", "2026-10-19", window), true);
  assert.equal(calendarWindowCovers("week", "2026-10-26", window), false);
});

test("calendar Realtime publishes booking changes without profile token payloads", () => {
  const migration = readFileSync(new URL("../supabase/migrations/0042_calendar_realtime.sql", import.meta.url), "utf8");
  for (const table of ["appointments", "booking_requests", "appointment_proposals", "blocked_times", "services"]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.doesNotMatch(migration, /'profiles'/);
  assert.match(migration, /pg_publication_tables/);
});
