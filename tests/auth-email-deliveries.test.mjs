import assert from "node:assert/strict";
import test from "node:test";

import { authEmailDeliveries } from "../src/domain/auth-email-deliveries.ts";

test("normal auth mail has one delivery to the account address", () => {
  assert.deepEqual(authEmailDeliveries({
    user: { email: "old@example.com" },
    email_data: { token_hash: "signup-hash", email_action_type: "signup" },
  }), [{ to: "old@example.com", tokenHash: "signup-hash" }]);
});

test("secure email change delivers each hash to the matching address", () => {
  assert.deepEqual(authEmailDeliveries({
    user: { email: "old@example.com", new_email: "new@example.com" },
    email_data: {
      email_action_type: "email_change",
      token_hash_new: "old-hash",
      token_hash: "new-hash",
    },
  }), [
    { to: "old@example.com", tokenHash: "old-hash" },
    { to: "new@example.com", tokenHash: "new-hash" },
  ]);
});

test("non-secure email change sends only to the new address", () => {
  assert.deepEqual(authEmailDeliveries({
    user: { email: "old@example.com", new_email: "new@example.com" },
    email_data: { email_action_type: "email_change", token_hash: "new-hash" },
  }), [{ to: "new@example.com", tokenHash: "new-hash" }]);
});

test("missing hash or destination fails closed", () => {
  assert.deepEqual(authEmailDeliveries({
    user: { email: "old@example.com" },
    email_data: { email_action_type: "email_change", token_hash: "new-hash" },
  }), []);
  assert.deepEqual(authEmailDeliveries({
    user: { email: "old@example.com" },
    email_data: { email_action_type: "signup" },
  }), []);
});
