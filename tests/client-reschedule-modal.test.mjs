import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const upcoming = readFileSync("src/components/client/upcoming-appointments.tsx", "utf8");

test("client reschedule modal is wider on desktop without changing mobile width", () => {
  const modalCall = upcoming.slice(
    upcoming.indexOf("{/* Reschedule picker */}"),
    upcoming.indexOf("<SlotPicker"),
  );

  assert.match(modalCall, /className="sm:!max-w-4xl/);
  assert.doesNotMatch(modalCall, /max-w-\[/);
});
