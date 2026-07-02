import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatEmailDate } from "../src/emails/date.ts";

const layout = readFileSync("src/emails/layout.tsx", "utf8");

for (const file of [
  "src/emails/appointment-cancelled.tsx",
  "src/emails/appointment-confirmed.tsx",
  "src/emails/appointment-proposed.tsx",
  "src/emails/appointment-reminder.tsx",
  "src/emails/appointment-rescheduled.tsx",
  "src/emails/booking-request.tsx",
  "src/emails/client-responded.tsx",
]) {
  test(`${file} formats date detail values for Slovak email display`, () => {
    const source = readFileSync(file, "utf8");
    assert.match(source, /formatEmailDate/);
    assert.doesNotMatch(source, /label="[^"]*date" value=\{date\}/i);
  });
}

test("email date format includes Slovak weekday and DD.MM.YYYY", () => {
  const source = readFileSync("src/emails/date.ts", "utf8");
  assert.match(source, /sk-SK/);
  assert.match(source, /weekday:\s*"long"/);
  assert.equal(formatEmailDate("2026-07-02"), "štvrtok 02.07.2026");
});

test("email details card has no top border", () => {
  const detailsBody = layout.slice(
    layout.indexOf("export function EmailDetails"),
    layout.indexOf("export function EmailDetail({"),
  );

  assert.match(detailsBody, /border-x border-b/);
  assert.doesNotMatch(detailsBody, /rounded-xl border border-stone-200/);
});

test("confirmed appointment email includes Google and Apple calendar actions", () => {
  const source = readFileSync("src/emails/appointment-confirmed.tsx", "utf8");
  const actions = readFileSync("src/app/actions.ts", "utf8");

  assert.match(source, /buildCalendarLinks/);
  assert.match(source, /Add to Google Calendar/);
  assert.match(source, /Add to Apple Calendar/);
  assert.match(source, /startIso/);
  assert.match(source, /endIso/);
  assert.match(actions, /appointmentId/);
  assert.match(actions, /startIso: request\.requested_start/);
  assert.match(actions, /endIso: request\.requested_end/);
});

test("calendar link helpers build Google and Apple-compatible URLs", () => {
  const source = readFileSync("src/emails/calendar-links.ts", "utf8");
  const route = readFileSync("src/app/api/calendar/event/[appointmentId]/route.ts", "utf8");

  assert.match(source, /calendar\.google\.com\/calendar\/render/);
  assert.match(source, /\/api\/calendar\/event\/\$\{appointmentId\}/);
  assert.match(route, /Content-Type": "text\/calendar; charset=utf-8"/);
  assert.match(route, /appointmentUid\(appointment\.id\)/);
});
