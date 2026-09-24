import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adminCalendarWindowDates } from "../src/domain/calendar-window.ts";
import { redact } from "../src/lib/redact.ts";

const migration = readFileSync("supabase/migrations/0032_security_hardening.sql", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const cron = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");
const reminderClaim = readFileSync("src/server/reminder-claim.ts", "utf8");
const feed = readFileSync("src/app/api/calendar/feed/[token]/route.ts", "utf8");
const exportRoute = readFileSync("src/app/api/calendar/export/route.ts", "utf8");
const ics = readFileSync("src/lib/ics.ts", "utf8");
const email = readFileSync("src/lib/email.ts", "utf8");
const serverClient = readFileSync("src/lib/supabase/server.ts", "utf8");
const auth = readFileSync("src/server/auth.ts", "utf8");
const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

function section(source, startPattern, endPattern) {
  const start = source.search(startPattern);
  assert.notEqual(start, -1, `missing ${startPattern}`);
  // Skip the first character so an end pattern that also matches the start
  // (e.g. the next "export async function …Action") is found AFTER it.
  const end = source.slice(start + 1).search(endPattern);
  return end === -1 ? source.slice(start) : source.slice(start, start + 1 + end);
}

test("booking prices can only be written server-side", () => {
  assert.match(migration, /drop policy if exists "booking requests approved client insert"/);
  assert.match(migration, /drop function if exists public\.client_request_reschedule\(uuid, timestamptz, integer, boolean\)/);
  assert.match(migration, /revoke execute on function public\.client_request_reschedule\(uuid, uuid, timestamptz, integer, boolean\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.client_request_reschedule\(uuid, uuid, timestamptz, integer, boolean\) to service_role/);
  const create = section(actions, /export async function createBookingRequestAction/, /export async function \w+Action/);
  assert.match(create, /getSupabaseAdminClient\(\)\.from\("booking_requests"\)\.insert\(/);
  const reschedule = section(actions, /export async function requestRescheduleAction/, /export async function \w+Action/);
  assert.match(reschedule, /getSupabaseAdminClient\(\)\.rpc\("client_request_reschedule", \{\s*p_appointment_id[^}]*p_client_id: profile\.id/);
});

test("client RPCs require an approved account and anon execute is revoked", () => {
  assert.match(migration, /create or replace function public\.is_approved_client\(\)/);
  for (const fn of ["respond_to_appointment_proposal", "client_cancel_confirmed_appointment", "client_cancel_request"]) {
    const body = section(migration, new RegExp(`create or replace function public\\.${fn}\\(`), /\$\$;\n/);
    assert.match(body, /public\.is_approved_client\(\)/, fn);
  }
  for (const fn of ["is_admin\\(\\)", "confirmed_appointment_slots\\(\\)", "has_confirmed_appointment_overlap\\(uuid, timestamptz, timestamptz, uuid\\)", "confirm_booking_request\\(uuid, uuid\\)", "record_admin_action\\(text, text, text, jsonb\\)"]) {
    assert.match(migration, new RegExp(`revoke execute on function public\\.${fn} from public, anon`), fn);
  }
  assert.match(migration, /revoke execute on function public\.phone_taken\(text\) from public, anon, authenticated/);
  assert.match(actions, /getSupabaseAdminClient\(\)\.rpc\("phone_taken"/);
});

test("feed tokens rotate, feeds require approval, storage buckets are capped", () => {
  assert.match(migration, /create or replace function public\.rotate_my_calendar_token\(\)/);
  assert.match(migration, /owner\.approval_status = 'approved'/);
  assert.match(migration, /appointment_proposals_one_sent_per_request/);
  assert.match(migration, /allowed_mime_types = array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  assert.match(migration, /create trigger profiles_scrub_notifications/);
  assert.match(actions, /export async function rotateCalendarTokenAction/);
  assert.match(feed, /z\.uuid\(\)\.safeParse\(token\)/);
  assert.match(feed, /createHash\("sha256"\)\.update\(token\)/);
  assert.match(feed, /enforceRateLimit\("calendar:feed-ip"/);
  assert.match(exportRoute, /approval_status !== "approved"/);
  assert.match(exportRoute, /shopDayRangeUtc/);
});

test("cron claims the reminder stamp before sending and bounds its runtime", () => {
  assert.match(cron, /export const maxDuration = 60/);
  const claim = cron.indexOf("await claimReminder(supabase, appt, claimAt, windowEnd)");
  const send = cron.indexOf("const delivered = await sendEmail({");
  assert.ok(claim > -1 && send > claim, "claim must precede the send");
  assert.match(reminderClaim, /\.eq\("status", "confirmed"\)/);
  assert.match(reminderClaim, /\.eq\("starts_at", appointment\.starts_at\)/);
  assert.match(reminderClaim, /\.gt\("starts_at", claimAtIso\)/);
  assert.match(reminderClaim, /\.is\("reminded_at", null\)/);
  assert.match(reminderClaim, /update\(\{ reminded_at: null \}\)/);
  assert.match(reminderClaim, /\.eq\("reminded_at", claimAtIso\)/);
  assert.match(cron, /reminderStillCurrent/);
  assert.match(cron, /\.in\("id", clientIds\)/);
  assert.match(cron, /createNotifications\(supabase, notifications\)/);
  assert.match(cron, /from\("rate_limits"\)\s*\.delete/);
  assert.doesNotMatch(cron, /error\.message/);
});

test("auth rate limits are keyed per IP as well as per email", () => {
  for (const scope of ["auth:sign-in-ip", "auth:register-ip", "auth:reset-request-ip", "auth:resend-confirmation-ip"]) {
    assert.match(actions, new RegExp(`enforceRateLimit\\("${scope}"`), scope);
  }
});

test("admin state machine and GDPR paths", () => {
  const reject = section(actions, /export async function rejectClientAction/, /export async function \w+Action/);
  assert.match(reject, /\.eq\("approval_status", "pending"\)/);
  assert.doesNotMatch(reject, /error\?\.message/);
  const unblock = section(actions, /export async function unblockClientAction/, /export async function \w+Action/);
  assert.match(unblock, /\.eq\("approval_status", "blocked"\)/);
  for (const fn of ["exportMyDataAction", "deleteMyAccountAction"]) {
    const body = section(actions, new RegExp(`export async function ${fn}`), /export async function \w+Action/);
    assert.match(body, /requireProfile\(\)/, fn);
    assert.doesNotMatch(body, /requireApprovedClient\(\)/, fn);
  }
  assert.match(actions, /authNoticePath\("\/login", "account_deleted"\)/);
  const respond = section(actions, /export async function respondToProposalAction/, /export async function \w+Action/);
  assert.match(respond, /response\.data\.accepted && !isStartInClientBookingWindow/);
  const slice = section(actions, /export async function blockDateAction/, /export async function \w+Action/);
  assert.match(slice, /parsed\.data\.end !== parsed\.data\.start/);
});

test("logs never carry personal data", () => {
  assert.equal(redact("duplicate key value (jane.doe@example.com) for +421 900 123 456"), "duplicate key value ([email]) for [phone]");
  assert.equal(redact("row 2026-09-18 id 12345"), "row 2026-09-18 id 12345");
  assert.doesNotMatch(email, /"→", payload\.to/);
  assert.doesNotMatch(email, /subject: payload\.subject \}/);
  assert.match(email, /import "server-only"/);
  assert.match(ics, /\\r\\n\|\\r\|\\n/);
});

test("request-scoped caching and bounded admin loaders", () => {
  assert.match(serverClient, /export const createClient = cache\(async \(\) =>/);
  assert.match(auth, /export const getCurrentProfile = cache\(async \(\) =>/);
  assert.match(dashboardData, /const PROFILE_SELECT =/);
  assert.doesNotMatch(dashboardData, /from\("profiles"\)\.select\("\*"\)/);
  const overview = section(dashboardData, /export async function loadAdminOverview/, /\/\*\* Admin calendar: confirmed appointments/);
  assert.match(overview, /\.gte\("starts_at", floor\)/);
  assert.doesNotMatch(overview, /from\("notifications"\)/);
  assert.deepEqual(adminCalendarWindowDates("2026-09-18", "2026-01-01"), { fromDate: "2026-08-01", toDate: "2026-11-01" });
  assert.deepEqual(adminCalendarWindowDates("garbage", "2026-12-15"), { fromDate: "2026-11-01", toDate: "2027-02-01" });
  assert.match(dashboardData, /export function adminCalendarWindow\(date: string\)/);
  const booking = section(dashboardData, /export async function loadBookingData/, /export async function \w+/);
  assert.match(booking, /\.eq\("status", "pending"\)\s*\.gte\("requested_start", nowIso\)/);
});

test("dependencies carry no known vulnerable Next.js release", () => {
  const [major, minor, patch] = pkg.dependencies.next.split(".").map(Number);
  assert.ok(major > 16 || (major === 16 && (minor > 3 || (minor === 3 && patch >= 3))), "next must be >= 16.3.3 (image optimizer RCE)");
});
