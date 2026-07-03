import assert from "node:assert/strict";
import test from "node:test";

import {
  badgeCountForRole,
  derivePushNotification,
} from "../src/server/push-payloads.ts";

test("admin badge count includes only actionable attention counts", () => {
  assert.equal(
    badgeCountForRole({
      role: "admin",
      attention: { requests: 4, approvals: 2 },
      unreadNotifications: 99,
    }),
    6,
  );
});

test("client badge count uses unread notification count", () => {
  assert.equal(
    badgeCountForRole({
      role: "client",
      attention: { requests: 4, approvals: 2 },
      unreadNotifications: 7,
    }),
    7,
  );
});

test("push payload keeps useful subject details but excludes free-text note body", () => {
  const payload = derivePushNotification(
    {
      subject: "Michaela requested Friday at 10:00",
      body: "Client note: please use the side entrance.",
    },
    {
      badgeCount: 3,
      url: "/admin/requests",
    },
  );

  assert.equal(payload.title, "Michaela requested Friday at 10:00");
  assert.equal(payload.badgeCount, 3);
  assert.equal(payload.url, "/admin/requests");
  assert.equal(payload.body, undefined);
});
