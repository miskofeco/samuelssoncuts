import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appointmentActions = readFileSync(
  "src/components/client/confirmed-appointment-actions.tsx",
  "utf8",
);

test("client reschedule modal is wider on desktop without changing mobile width", () => {
  const modalCall = appointmentActions.slice(
    appointmentActions.indexOf("<Modal"),
    appointmentActions.indexOf("<SlotPicker"),
  );

  assert.match(modalCall, /className="sm:!max-w-4xl/);
  assert.doesNotMatch(modalCall, /max-w-\[/);
});
