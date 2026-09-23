import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { openCalendarRequestSlots } from "../src/domain/calendar-open-requests.ts";

const pending = {
  id: "request-pending",
  status: "pending",
  requestedDate: "2026-10-07",
  requestedTime: "19:00",
};
const proposed = {
  id: "request-proposed",
  status: "proposed",
  requestedDate: "2026-10-08",
  requestedTime: "18:00",
  proposalId: "proposal-active",
};

test("calendar shows the client's pending exact-slot request", () => {
  assert.deepEqual(openCalendarRequestSlots([pending], []), [
    { kind: "pending", request: pending, date: "2026-10-07", time: "19:00" },
  ]);
});

test("calendar shows only the active sent proposal, not the old requested slot", () => {
  const expired = {
    id: "proposal-expired",
    requestId: proposed.id,
    status: "expired",
    date: "2026-10-09",
    time: "17:00",
  };
  const active = {
    id: "proposal-active",
    requestId: proposed.id,
    status: "sent",
    date: "2026-10-10",
    time: "16:00",
  };
  assert.deepEqual(openCalendarRequestSlots([proposed], [expired, active]), [
    { kind: "proposed", request: proposed, proposal: active, date: "2026-10-10", time: "16:00" },
  ]);
});

test("calendar omits requests without an exact slot or an active proposal", () => {
  assert.deepEqual(
    openCalendarRequestSlots(
      [
        { ...pending, id: "legacy", requestedTime: undefined },
        { ...proposed, proposalId: "missing" },
        { ...pending, id: "confirmed", status: "confirmed" },
        { ...pending, id: "declined", status: "declined" },
      ],
      [],
    ),
    [],
  );
});

test("calendar request details use admin decision actions, not the client cancellation action", () => {
  const modal = readFileSync("src/components/admin/appointment-detail-modal.tsx", "utf8");
  assert.match(modal, /confirmRequestAction\(item\.requestId/);
  assert.match(modal, /declineRequestAdminAction\(/);
  assert.match(modal, /proposeAppointmentAction\(/);
  assert.doesNotMatch(modal, /cancelRequestAction/);
  assert.match(modal, /grid gap-2 border-t pt-4 sm:grid-cols-2/);
  assert.match(modal, /canConfirmRequest \? "w-full sm:col-span-2" : "w-full"/);
});
