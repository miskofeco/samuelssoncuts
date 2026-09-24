import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adminNewRequestPush,
  adminProposalResponsePush,
  adminRescheduleRequestPush,
  clientConfirmedPush,
  clientReminderPush,
  clientRequestReceivedPush,
  clientRescheduledPush,
  formatPushWhen,
} from "../src/domain/push-copy.ts";

test("push copy formats the slot as a short Slovak weekday date and time", () => {
  assert.equal(formatPushWhen("2026-10-01", "15:00"), "št 1. 10. · 15:00");
});

test("barber pushes lead with the action and put client, service and slot in the body", () => {
  const request = adminNewRequestPush({
    client: "Michal Fečo",
    service: "Signature cut",
    date: "2026-10-01",
    time: "15:00",
  });
  assert.equal(request.title, "Nová žiadosť o termín");
  assert.equal(request.body, "Michal Fečo · Signature cut\nšt 1. 10. · 15:00");

  const accepted = adminProposalResponsePush({
    client: "Lukáš Hirka",
    service: "Signature cut",
    date: "2026-10-02",
    time: "09:30",
    accepted: true,
  });
  assert.equal(accepted.title, "Klient potvrdil navrhnutý termín");
  assert.equal(accepted.body, "Lukáš Hirka · Signature cut\npi 2. 10. · 09:30");

  const move = adminRescheduleRequestPush({ client: "Janko", service: null, date: "2026-10-02", time: "10:00" });
  assert.equal(move.body, "Janko\nNový čas: pi 2. 10. · 10:00");
});

test("client pushes omit the client's own name and keep bodies to structured details", () => {
  const received = clientRequestReceivedPush({ service: "Signature cut", date: "2026-10-01", time: "15:00" });
  assert.equal(received.title, "Žiadosť o termín prijatá");
  assert.equal(received.body, "Signature cut · št 1. 10. · 15:00\nTermín bude ešte potvrdený.");

  const confirmed = clientConfirmedPush({ service: undefined, date: "2026-10-01", time: "15:00" });
  assert.equal(confirmed.title, "Termín potvrdený");
  assert.equal(confirmed.body, "št 1. 10. · 15:00");

  const moved = clientRescheduledPush({ service: "Beard shape", date: "2026-10-03", time: "11:00" });
  assert.equal(moved.body, "Beard shape\nNový čas: so 3. 10. · 11:00");

  const reminder = clientReminderPush({ service: "Signature cut", date: "2026-10-01", time: "15:00" });
  assert.equal(reminder.title, "Zajtra máte termín");
  const sameDayReminder = clientReminderPush({
    service: "Signature cut", date: "2026-10-01", time: "15:00", relativeDay: "today",
  });
  assert.equal(sameDayReminder.title, "Dnes máte termín");
});

test("every push-enabled notification passes structured push copy", () => {
  const actions = readFileSync("src/app/actions.ts", "utf8");
  const cron = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");
  const pushUrls = (actions.match(/pushUrl: "/g) ?? []).length + (cron.match(/pushUrl: "/g) ?? []).length;
  const pushCopies = (actions.match(/\bpush: \w+Push\(/g) ?? []).length + (cron.match(/\bpush: \w+Push\(/g) ?? []).length;
  assert.ok(pushUrls > 0);
  assert.equal(pushCopies, pushUrls);
  // Free-text notes and reasons never feed push copy.
  assert.doesNotMatch(actions, /Push\(\{[^}]*(note|reason)\b/s);
});
