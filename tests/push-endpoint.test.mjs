import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedPushEndpoint } from "../src/domain/push-endpoint.ts";

test("accepts HTTPS endpoints from supported browser push services", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/abc123",
    "https://web.push.apple.com/abc123",
    "https://api.push.apple.com/3/device/abc123",
  ]) {
    assert.equal(isAllowedPushEndpoint(endpoint), true, endpoint);
  }
});

test("rejects destinations usable for SSRF and non-push URLs", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/abc123",
    "https://127.0.0.1:8443/internal",
    "https://[::1]/internal",
    "https://fcm.googleapis.com.evil.example/fcm/send/abc123",
    "https://evilpush.apple.com/abc123",
    "https://user:pass@web.push.apple.com/abc123",
    "https://fcm.googleapis.com:8443/fcm/send/abc123",
    "https://fcm.googleapis.com:443/fcm/send/abc123",
    "https://fcm.googleapis.com/",
    "https://web.push.apple.com/abc123?next=internal",
    "https://web.push.apple.com/abc123#fragment",
    "not a url",
  ]) {
    assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
  }
});
