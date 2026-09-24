import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyOAuthProviderError,
  isNewOAuthAccount,
  oauthLandingPath,
  oauthStartPath,
  parseOAuthIntent,
} from "../src/domain/oauth-landing.ts";
import { dictionaries } from "../src/i18n/dictionaries.ts";
import { resolveAuthError } from "../src/i18n/auth-notices.ts";

test("intent defaults to login and returns failures to the starting page", () => {
  assert.equal(parseOAuthIntent("register"), "register");
  assert.equal(parseOAuthIntent("login"), "login");
  assert.equal(parseOAuthIntent("admin"), "login");
  assert.equal(parseOAuthIntent(undefined), "login");
  assert.equal(oauthStartPath("register"), "/register");
  assert.equal(oauthStartPath("login"), "/login");
});

test("an unregistered Google account from the login page starts registration and says so", () => {
  assert.equal(
    oauthLandingPath({ intent: "login", needsPhone: true, isNewAccount: true }),
    "/complete-profile?notice=google_registered",
  );
  assert.equal(
    oauthLandingPath({ intent: "login", needsPhone: true, isNewAccount: false }),
    "/complete-profile?notice=registration_incomplete",
  );
  assert.equal(oauthLandingPath({ intent: "register", needsPhone: true, isNewAccount: true }), "/complete-profile");
  assert.equal(oauthLandingPath({ intent: "login", needsPhone: false, isNewAccount: false }), "/dashboard");
  assert.equal(oauthLandingPath({ intent: "register", needsPhone: false, isNewAccount: true }), "/dashboard");
});

test("new accounts are recognised by created_at matching the first sign-in", () => {
  const now = "2026-09-24T20:00:00.000Z";
  assert.equal(isNewOAuthAccount({ created_at: now, last_sign_in_at: "2026-09-24T20:00:01.500Z" }), true);
  assert.equal(isNewOAuthAccount({ created_at: now, last_sign_in_at: null }), true);
  assert.equal(isNewOAuthAccount({ created_at: "2026-09-01T10:00:00.000Z", last_sign_in_at: now }), false);
  assert.equal(isNewOAuthAccount(null), false);
});

test("disabled sign-ups are not mistaken for a cancelled consent", () => {
  assert.equal(classifyOAuthProviderError({ error: "access_denied", errorCode: null, description: null }), "cancelled");
  assert.equal(
    classifyOAuthProviderError({ error: "access_denied", errorCode: "signup_disabled", description: "Signups not allowed for this instance" }),
    "not_registered",
  );
  assert.equal(
    classifyOAuthProviderError({ error: "invalid_request", errorCode: null, description: "Signups not allowed for this instance" }),
    "not_registered",
  );
  assert.equal(
    classifyOAuthProviderError({ error: "server_error", errorCode: "unexpected_failure", description: "Database error saving new user" }),
    "failed",
  );
});

test("the not-registered and registration notices are localised", () => {
  for (const dict of Object.values(dictionaries)) {
    assert.ok(resolveAuthError(dict, "oauth_not_registered")?.length > 10);
    assert.ok(dict.auth.notices.googleRegistered.length > 10);
    assert.ok(dict.auth.notices.registrationIncomplete.length > 10);
  }
});

test("the OAuth action, callback and pages carry the intent through", () => {
  const actions = readFileSync("src/app/actions.ts", "utf8");
  const oauthAction = actions.slice(actions.indexOf("export async function signInWithOAuthAction"), actions.indexOf("export async function registerAction"));
  const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
  const buttons = readFileSync("src/components/auth/oauth-buttons.tsx", "utf8");
  const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
  const registerPage = readFileSync("src/app/register/page.tsx", "utf8");
  const completePage = readFileSync("src/app/complete-profile/page.tsx", "utf8");

  assert.match(buttons, /name="intent" value=\{intent\}/);
  assert.match(loginPage, /<OAuthButtons intent="login" \/>/);
  assert.match(registerPage, /<OAuthButtons intent="register" \/>/);
  assert.match(oauthAction, /OAUTH_INTENT_COOKIE/);
  assert.match(oauthAction, /httpOnly: true/);
  // The callback URL stays exactly as allow-listed in Supabase (no intent query).
  assert.match(oauthAction, /redirectTo: `\$\{getSiteUrl\(\)\}\/auth\/callback`/);
  assert.match(callback, /classifyOAuthProviderError/);
  assert.match(callback, /oauthLandingPath\(/);
  assert.match(callback, /cookies\.set\(OAUTH_INTENT_COOKIE, "", \{ path: "\/auth", maxAge: 0 \}\)/);
  assert.match(registerPage, /resolveAuthError\(t, params\.error\)/);
  assert.match(completePage, /googleRegistered/);
});
