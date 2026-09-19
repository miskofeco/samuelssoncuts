import assert from "node:assert/strict";
import test from "node:test";

import { derivePushNotification } from "../src/server/push-payloads.ts";

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
