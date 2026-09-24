import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { authErrorKind } from "../src/domain/auth-errors.ts";
import { dictionaries } from "../src/i18n/dictionaries.ts";

const err = (code, status, message = "") => ({ code, status, message });

test("auth errors map to the problem the person can act on", () => {
  assert.equal(authErrorKind(err("user_already_exists", 422)), "email_taken");
  assert.equal(authErrorKind(err("email_exists", 422)), "email_taken");
  assert.equal(authErrorKind(err("weak_password", 422)), "weak_password");
  assert.equal(authErrorKind(err("email_address_invalid", 400)), "email_invalid");
  assert.equal(authErrorKind(err("validation_failed", 400, "Unable to validate email address: invalid format")), "email_invalid");
  assert.equal(authErrorKind(err("over_email_send_rate_limit", 429)), "rate_limited");
  assert.equal(authErrorKind(err("over_request_rate_limit", 429)), "rate_limited");
  assert.equal(authErrorKind(err(undefined, 429)), "rate_limited");
  assert.equal(authErrorKind(err("signup_disabled", 422)), "signup_disabled");
  assert.equal(authErrorKind(err("email_provider_disabled", 422)), "signup_disabled");
  assert.equal(authErrorKind(err("hook_timeout", 500)), "email_delivery");
  assert.equal(authErrorKind(err("hook_timeout_after_retry", 500)), "email_delivery");
  assert.equal(authErrorKind(err("email_address_not_authorized", 400)), "email_delivery");
  assert.equal(authErrorKind(err("unexpected_failure", 500, "Error sending confirmation email")), "email_delivery");
  assert.equal(authErrorKind(err("invalid_credentials", 400)), "invalid_credentials");
  assert.equal(authErrorKind(err("email_not_confirmed", 400)), "email_not_confirmed");
  assert.equal(authErrorKind(err("same_password", 422)), "same_password");
  assert.equal(authErrorKind(err("user_banned", 400)), "banned");
});

test("database and unknown failures stay generic so they are reported", () => {
  assert.equal(authErrorKind(err("unexpected_failure", 500, "Database error saving new user")), "unknown");
  assert.equal(authErrorKind(err(undefined, 500)), "unknown");
  assert.equal(authErrorKind(null), "unknown");
  assert.equal(authErrorKind({ message: "fetch failed" }), "unknown");
});

test("every auth error kind has copy in both languages", () => {
  for (const dict of Object.values(dictionaries)) {
    for (const key of ["passwordWeak", "emailDeliveryFailed", "signupDisabled", "accountBanned"]) {
      assert.equal(typeof dict.auth.errors[key], "string", key);
      assert.ok(dict.auth.errors[key].length > 10, key);
    }
  }
});

test("register, sign-in and password update use the classifier", () => {
  const actions = readFileSync("src/app/actions.ts", "utf8");
  const register = actions.slice(actions.indexOf("export async function registerAction"));
  const signIn = actions.slice(actions.indexOf("export async function signInAction"), actions.indexOf("export async function resendConfirmationAction"));
  const updatePw = actions.slice(actions.indexOf("export async function updatePasswordAction"), actions.indexOf("export async function signInWithOAuthAction"));
  for (const source of [register, signIn, updatePw]) {
    assert.match(source, /authErrorKind\(error\)/);
  }
});

test("error reports keep the message of non-Error objects such as PostgrestError", () => {
  const observability = readFileSync("src/lib/observability.ts", "utf8");
  assert.match(observability, /details/);
});

test("the phone regex fix is a new migration with a literal trailing hyphen", () => {
  const migration = readFileSync("supabase/migrations/0053_fix_normalize_phone_regex.sql", "utf8");
  assert.match(migration, /'\[\[:space:\]\(\)\.-\]'/);
  assert.doesNotMatch(migration.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n"), /\\\\/);
});
