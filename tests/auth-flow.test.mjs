import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { dictionaries } from "../src/i18n/dictionaries.ts";
import {
  authErrorPath,
  authNoticePath,
  noticeOffersResend,
  resolveAuthError,
  resolveAuthNotice,
} from "../src/i18n/auth-notices.ts";

const actions = readFileSync("src/app/actions.ts", "utf8");
const auth = readFileSync("src/server/auth.ts", "utf8");
const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
const registerPage = readFileSync("src/app/register/page.tsx", "utf8");
const loginForm = readFileSync("src/components/auth/login-form.tsx", "utf8");
const registerForm = readFileSync("src/components/auth/register-form.tsx", "utf8");
const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
const confirm = readFileSync("src/app/auth/confirm/route.ts", "utf8");
const updatePassword = readFileSync("src/app/auth/update-password/page.tsx", "utf8");
const pendingPage = readFileSync("src/app/pending/page.tsx", "utf8");
const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");
const notifications = readFileSync("src/server/notifications.ts", "utf8");
const approvalQueue = readFileSync("src/components/admin/approval-queue.tsx", "utf8");
const adminOverview = readFileSync("src/components/admin/admin-overview.tsx", "utf8");
const migration = readFileSync("supabase/migrations/0031_phone_taken_normalized.sql", "utf8");

function section(source, startPattern, endPattern) {
  const start = source.search(startPattern);
  assert.notEqual(start, -1, `missing ${startPattern}`);
  const end = source.slice(start).search(endPattern);
  return end === -1 ? source.slice(start) : source.slice(start, start + end);
}

const signIn = section(actions, /export async function signInAction/, /export async function resendConfirmationAction/);
const resend = section(actions, /export async function resendConfirmationAction/, /export async function requestPasswordResetAction/);
const updatePw = section(actions, /export async function updatePasswordAction/, /export async function signInWithOAuthAction/);
const register = section(actions, /export async function registerAction/, /export async function signOutAction/);
const approve = section(actions, /export async function approveClientAction/, /export async function rejectClientAction/);
const updateProfile = section(actions, /export async function updateProfileAction/, /export async function completePhoneAction/);
const completePhone = section(actions, /export async function completePhoneAction/, /\/\/ -{10,}/);

test("auth notice codes resolve to localised copy in both languages and drop unknown codes", () => {
  for (const t of [dictionaries.en, dictionaries.sk]) {
    assert.equal(resolveAuthError(t, "oauth_failed"), t.auth.errors.oauthFailed);
    assert.equal(resolveAuthError(t, "oauth_cancelled"), t.auth.errors.oauthCancelled);
    assert.equal(resolveAuthError(t, "reset_link_invalid"), t.auth.resetLinkInvalid);
    assert.equal(resolveAuthError(t, "profile_missing"), t.auth.errors.profileMissing);
    assert.equal(resolveAuthError(t, "<script>alert(1)</script>"), null);
    assert.equal(resolveAuthError(t, undefined), null);
    assert.equal(resolveAuthNotice(t, "confirm_sent", "a@b.sk"), t.auth.notices.confirmSent("a@b.sk"));
    assert.equal(resolveAuthNotice(t, "password_updated"), t.auth.updated);
    assert.equal(resolveAuthNotice(t, "anything else"), null);
  }
  assert.equal(authErrorPath("/login", "oauth_failed"), "/login?error=oauth_failed");
  assert.equal(authNoticePath("/login", "confirm_sent", "a+b@c.sk"), "/login?notice=confirm_sent&email=a%2Bb%40c.sk");
  assert.equal(noticeOffersResend("confirm_sent"), true);
  assert.equal(noticeOffersResend("password_updated"), false);
});

test("sign-in returns field-level state, distinguishes an unconfirmed email and offers a resend", () => {
  assert.match(signIn, /_previous: AuthFormState/);
  assert.match(signIn, /kind === "email_not_confirmed"/);
  assert.match(signIn, /unconfirmedEmail: email/);
  assert.match(signIn, /kind === "invalid_credentials"/);
  assert.match(signIn, /enforceRateLimit\("auth:sign-in"/);
  assert.doesNotMatch(signIn, /redirect\(`\/login\?error=/);
  assert.match(resend, /supabase\.auth\.resend\(\{\s*type: "signup"/);
  assert.match(resend, /enforceRateLimit\("auth:resend-confirmation"/);
  assert.match(loginForm, /useActionState\(signInAction/);
  assert.match(loginForm, /resendConfirmationAction/);
  assert.match(loginForm, /error=\{state\.fieldErrors\?\.email\}/);
});

test("registration validates every field, normalises the phone and detects an existing email", () => {
  assert.match(register, /fieldErrors\.fullName = t\.auth\.errors\.nameTooShort/);
  assert.match(register, /fieldErrors\.email = t\.auth\.errors\.emailInvalid/);
  assert.match(register, /const phone = parsePhone\(phoneInput\)/);
  assert.match(register, /fieldErrors\.phone = t\.auth\.errors\.phoneInvalid/);
  assert.match(register, /fieldErrors\.password = t\.auth\.errors\.passwordTooShort/);
  assert.match(register, /isPhoneTaken\(phone\)/);
  // Supabase hides an existing account behind an empty identities array.
  assert.match(register, /isExistingUserSignUp\(data\.user\)/);
  assert.match(actions, /user\.identities\.length === 0/);
  assert.match(register, /case "email_taken"/);
  assert.match(register, /authNoticePath\("\/login", "confirm_sent", email\)/);
  assert.match(register, /if \(data\.session\)/);
  assert.match(registerForm, /useActionState\(registerAction/);
  for (const field of ["fullName", "email", "phone", "password"]) {
    assert.match(registerForm, new RegExp(`error=\\{state\\.fieldErrors\\?\\.${field}\\}`));
  }
});

test("phone completion and profile edits share the canonical phone rules", () => {
  assert.match(completePhone, /parsePhone\(/);
  assert.match(completePhone, /t\.auth\.errors\.phoneInvalid/);
  assert.match(updateProfile, /parsePhone\(parsed\.data\.phone\)/);
  // Unchanged phone must not be reported as taken (phone_taken matches own row).
  assert.match(updateProfile, /phone !== profile\.phone && \(await isPhoneTaken/);
  assert.match(migration, /normalize_phone\(phone\) = public\.normalize_phone\(p_phone\)/);
});

test("approval requires a confirmed email and a phone everywhere the queue is counted", () => {
  assert.match(approve, /select\("email_confirmed_at, phone, role"\)/);
  assert.match(approve, /isReadyForApproval\(/);
  assert.match(approve, /t\.feedback\.phoneMissing/);
  assert.match(approvalQueue, /clients\.filter\(isReadyForApproval\)/);
  assert.match(adminOverview, /isReadyForApproval\(c\)/);
  const attention = section(dashboardData, /export async function loadAttentionCounts/, /export async function loadAllServices/);
  assert.match(attention, /\.not\("email_confirmed_at", "is", null\)\s*\.not\("phone", "is", null\)/);
  const badge = section(notifications, /async function badgeCountForUser/, /function absoluteUrl/);
  assert.match(badge, /\.not\("email_confirmed_at", "is", null\)\s*\.not\("phone", "is", null\)/);
});

test("auth pages redirect signed-in users, never render raw URL text, and guard recovery", () => {
  for (const page of [loginPage, registerPage]) {
    assert.match(page, /getCurrentProfile\(\)/);
    assert.match(page, /redirect\(dashboardPathFor\(profile\)\)/);
  }
  assert.match(loginPage, /resolveAuthError\(t, params\.error\)/);
  assert.doesNotMatch(loginPage, /error=\{params\.error\}/);
  assert.match(loginPage, /if \(authenticated\)/);
  assert.match(auth, /"\/login\?error=profile_missing"/);
  assert.match(updatePassword, /supabase\.auth\.getClaims\(\)/);
  assert.match(updatePassword, /authErrorPath\("\/reset-password", "reset_link_invalid"\)/);
  assert.match(updatePw, /kind === "same_password"/);
  assert.match(updatePw, /authNoticePath\("\/login", "password_updated"\)/);
});

test("callback and confirm routes redirect with codes and route recovery failures to reset-password", () => {
  assert.match(callback, /failure === "cancelled"/);
  assert.match(callback, /fail\("oauth_cancelled"\)/);
  assert.match(callback, /authErrorPath\("\/reset-password", "reset_link_invalid"\)/);
  assert.doesNotMatch(callback, /encodeURIComponent\("Sign-in/);
  assert.match(confirm, /OTP_TYPES\.find/);
  assert.match(confirm, /authErrorPath\("\/login", "link_invalid"\)/);
  assert.match(confirm, /authErrorPath\("\/reset-password", "reset_link_invalid"\)/);
});

test("pending page only serves accounts that belong there and has blocked-specific copy", () => {
  assert.match(pendingPage, /const destination = dashboardPathFor\(profile\)/);
  assert.match(pendingPage, /if \(destination !== "\/pending"\)/);
  assert.match(pendingPage, /t\.pending\.blocked\(profile\.full_name\)/);
  assert.match(pendingPage, /t\.pending\.blockedTitle/);
});
