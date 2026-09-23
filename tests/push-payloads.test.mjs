import assert from "node:assert/strict";
import test from "node:test";

import { derivePushNotification } from "../src/server/push-payloads.ts";

test("push payload uses structured copy and excludes the free-text note body", () => {
  const payload = derivePushNotification(
    {
      subject: "Michaela žiada termín 2026-10-01 o 15:00",
      body: "Client note: please use the side entrance.",
      push: { title: "Nová žiadosť o termín", body: "Michaela · Signature cut\nšt 1. 10. · 15:00" },
    },
    {
      badgeCount: 3,
      url: "/admin/requests",
    },
  );

  assert.equal(payload.title, "Nová žiadosť o termín");
  assert.equal(payload.body, "Michaela · Signature cut\nšt 1. 10. · 15:00");
  assert.doesNotMatch(payload.body, /side entrance/);
  assert.equal(payload.badgeCount, 3);
  assert.equal(payload.url, "/admin/requests");
});

test("push payload without structured copy falls back to the subject and no body", () => {
  const payload = derivePushNotification(
    { subject: "Váš termín je potvrdený", body: "Poznámka od barbera." },
    { badgeCount: -2, url: "/client/reservations" },
  );

  assert.equal(payload.title, "Váš termín je potvrdený");
  assert.equal(payload.body, undefined);
  assert.equal(payload.badgeCount, 0);
});
