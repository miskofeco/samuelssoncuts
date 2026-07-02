import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
  .join("\n");

const actions = readFileSync("src/app/actions.ts", "utf8");
const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");
const env = readFileSync("src/lib/env.ts", "utf8");
const databaseTypes = readFileSync("src/lib/database.types.ts", "utf8");
const cronRoute = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");
const feedRoute = readFileSync("src/app/api/calendar/feed/[token]/route.ts", "utf8");
const readme = readFileSync("README.md", "utf8");

test("appointment RLS no longer exposes all raw appointment rows to every client", () => {
  const bookingDataBody = dashboardData.slice(
    dashboardData.indexOf("export async function loadBookingData"),
    dashboardData.indexOf("/** Admin overview metrics"),
  );
  assert.match(migrations, /drop policy if exists "appointments authenticated availability read"/);
  assert.match(migrations, /create policy "appointments own or admin read"/);
  assert.match(migrations, /client_id = auth\.uid\(\) or public\.is_admin\(\)/);
  assert.match(migrations, /confirmed_appointment_slots/);
  assert.match(dashboardData, /rpc\("confirmed_appointment_slots"/);
  assert.doesNotMatch(bookingDataBody, /from\("appointments"\)\.select\("\*"\)/);
});

test("client deletion uses Supabase admin API with service-role credentials", () => {
  assert.match(env, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(actions, /getSupabaseAdminClient/);
  assert.match(actions, /auth\.admin\.deleteUser\(clientId\)/);
  assert.match(readme, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("shop timezone is explicit and used when converting booking dates to instants", () => {
  const timezone = readFileSync("src/lib/time-zone.ts", "utf8");
  assert.match(timezone, /DEFAULT_SHOP_TIME_ZONE = "Europe\/Bratislava"/);
  assert.match(timezone, /zonedDateTimeToUtcIso/);
  assert.match(actions, /zonedDateTimeToUtcIso\(date, time\)/);
  assert.match(dashboardData, /formatInShopTimeZone/);
  assert.match(readme, /NEXT_PUBLIC_SHOP_TIME_ZONE/);
});

test("auth, booking, cron, and calendar feed paths enforce rate limits", () => {
  const rateLimit = readFileSync("src/server/rate-limit.ts", "utf8");
  assert.match(migrations, /create table if not exists public\.rate_limits/);
  assert.match(migrations, /create or replace function public\.check_rate_limit/);
  assert.match(rateLimit, /check_rate_limit/);
  assert.match(actions, /enforceRateLimit\("auth:sign-in"/);
  assert.match(actions, /enforceRateLimit\("booking:create-request"/);
  assert.match(actions, /enforceRateLimit\("booking:confirm-request"/);
  assert.match(cronRoute, /enforceRateLimit\("cron:reminders"/);
  assert.match(feedRoute, /enforceRateLimit\("calendar:feed"/);
});

test("booking confirmation and proposal responses use transactional DB RPCs", () => {
  const confirmBody = actions.slice(
    actions.indexOf("export async function confirmRequestAction"),
    actions.indexOf("export async function rescheduleAppointmentAction"),
  );
  const respondBody = actions.slice(
    actions.indexOf("export async function respondToProposalAction"),
    actions.indexOf("export async function redirectToDashboardAction"),
  );
  assert.match(migrations, /create or replace function public\.confirm_booking_request/);
  assert.match(migrations, /create or replace function public\.respond_to_appointment_proposal/);
  assert.match(actions, /rpc\("confirm_booking_request"/);
  assert.match(actions, /rpc\("respond_to_appointment_proposal"/);
  assert.doesNotMatch(confirmBody, /from\("appointments"\)\.insert/);
  assert.doesNotMatch(respondBody, /from\("appointments"\)\.insert/);
  assert.match(databaseTypes, /confirm_booking_request/);
  assert.match(databaseTypes, /respond_to_appointment_proposal/);
});

test("server errors are reported through the observability helper", () => {
  const observability = readFileSync("src/lib/observability.ts", "utf8");
  assert.match(observability, /logEvent/);
  assert.match(observability, /reportError/);
  assert.match(env, /ERROR_REPORT_WEBHOOK_URL/);
  assert.match(actions, /reportError\("delete-client"/);
  assert.match(cronRoute, /reportError\("cron-reminders"/);
  assert.match(feedRoute, /reportError\("calendar-feed"/);
  assert.match(readme, /ERROR_REPORT_WEBHOOK_URL/);
});
