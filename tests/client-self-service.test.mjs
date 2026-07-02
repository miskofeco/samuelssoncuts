import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0020_client_self_service.sql", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");

test("migration 0020 adds notification read-state and self-service RPCs", () => {
  assert.match(migration, /add column if not exists read_at timestamptz/);
  assert.match(migration, /create or replace function public\.client_cancel_confirmed_appointment/);
  assert.match(migration, /create or replace function public\.client_request_reschedule/);
  // Ownership + 24h enforced in SQL (defense in depth).
  assert.match(migration, /client_id <> auth\.uid\(\)/);
  assert.match(migration, /interval '24 hours'/);
  // Notifications owner-update policy for mark-as-read.
  assert.match(migration, /notifications own update/);
});

test("client cancel/reschedule actions enforce 24h and call the RPCs", () => {
  assert.match(actions, /cancelConfirmedAppointmentAction/);
  assert.match(actions, /requestRescheduleAction/);
  assert.match(actions, /client_cancel_confirmed_appointment/);
  assert.match(actions, /client_request_reschedule/);
  assert.match(actions, /CANCEL_LEAD_MS\s*=\s*24 \* 60 \* 60 \* 1000/);
});

test("GDPR self-service actions exist and are scoped to the caller", () => {
  assert.match(actions, /exportMyDataAction/);
  assert.match(actions, /deleteMyAccountAction/);
  // Deletion goes through the service-role admin client (like admin delete).
  assert.match(actions, /getSupabaseAdminClient\(\)/);
});

test("password reset flow wires resetPasswordForEmail + updateUser", () => {
  assert.match(actions, /resetPasswordForEmail/);
  assert.match(actions, /auth\.updateUser\(\{ password/);
});
