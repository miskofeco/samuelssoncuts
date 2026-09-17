import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("src/app/actions.ts", "utf8");
const schedule = readFileSync("src/domain/schedule.ts", "utf8");
const declineMigration = readFileSync(
  "supabase/migrations/0029_admin_decline_booking_request.sql",
  "utf8",
);
const calendarEventRoute = readFileSync(
  "src/app/api/calendar/event/[appointmentId]/route.ts",
  "utf8",
);

function actionBody(name, nextName) {
  return actions.slice(
    actions.indexOf(`export async function ${name}`),
    nextName ? actions.indexOf(`export async function ${nextName}`) : undefined,
  );
}

test("appointment lifecycle actions use transactional RPCs and preserve history", () => {
  const reschedule = actionBody("rescheduleAppointmentAction", "cancelAppointmentAdminAction");
  const cancelAdmin = actionBody("cancelAppointmentAdminAction", "createAdminBookingAction");
  const cancelRequest = actionBody("cancelRequestAction", "saveBusinessHoursAction");
  const blockClient = actionBody("blockClientAction", "unblockClientAction");

  assert.match(reschedule, /rpc\(\s*"admin_reschedule_appointment_to_proposal"/);
  assert.doesNotMatch(reschedule, /\.from\("appointments"\)[\s\S]*\.delete\(\)/);
  assert.match(cancelAdmin, /rpc\("admin_cancel_appointment"/);
  assert.doesNotMatch(cancelAdmin, /\.from\("appointments"\)[\s\S]*\.delete\(\)/);
  assert.match(cancelRequest, /rpc\("client_cancel_request"/);
  assert.doesNotMatch(cancelRequest, /\.from\("booking_requests"\)[\s\S]*\.update\(/);
  assert.match(blockClient, /rpc\("admin_cancel_appointment"/);
  assert.doesNotMatch(blockClient, /\.from\("appointments"\)[\s\S]*\.delete\(\)/);
});

test("admin request decline is atomic, audited, and notifies the client", () => {
  const decline = actionBody("declineRequestAdminAction", "confirmRequestAction");

  assert.match(declineMigration, /if not public\.is_admin\(\) then/);
  assert.match(declineMigration, /set status = 'declined'/);
  assert.match(declineMigration, /set status = 'expired'/);
  assert.match(declineMigration, /set search_path = ''/);
  assert.match(declineMigration, /revoke execute[\s\S]*from public, anon/);
  assert.match(decline, /rpc\("admin_decline_booking_request"/);
  assert.match(decline, /createNotification/);
  assert.match(decline, /BookingRequestDeclinedEmail/);
  assert.match(decline, /recordAdminAction\("request\.decline"/);
  assert.match(decline, /revalidatePath\("\/admin", "layout"\)/);
  assert.match(decline, /revalidatePath\("\/client", "layout"\)/);
});

test("client reschedule sends a fresh server-computed quote to the RPC", () => {
  const reschedule = actionBody("requestRescheduleAction", "exportMyDataAction");

  assert.match(reschedule, /quoteClientSlot/);
  assert.match(reschedule, /p_price_cents: quote\.priceCents/);
  assert.match(reschedule, /p_surcharge: quote\.surcharge/);
});

test("whole-day blocked ranges follow shop-local midnights across DST", () => {
  assert.match(actions, /zonedDateTimeToUtcIso\(parsed\.data\.start, "00:00"\)/);
  assert.match(actions, /zonedDateTimeToUtcIso\(addDaysToDate\(parsed\.data\.end, 1\), "00:00"\)/);
  assert.match(schedule, /const first = isoDateOnly\(start\) \? start : dateInShopTimeZone\(start\)/);
  assert.match(schedule, /new Date\(new Date\(end\)\.getTime\(\) - 1\)/);
  assert.match(schedule, /addDaysToDate\(cursor, 1\)/);
});

test("calendar event downloads require an authenticated owner or admin", () => {
  assert.match(calendarEventRoute, /getCurrentProfile\(\)/);
  assert.match(calendarEventRoute, /status:\s*401/);
  assert.match(calendarEventRoute, /profile\.role !== "admin"/);
  assert.match(calendarEventRoute, /appointment\.client_id !== profile\.id/);
});

test("privileged profile actions reject non-client targets", () => {
  for (const name of [
    "approveClientAction",
    "rejectClientAction",
    "blockClientAction",
    "deleteClientAction",
  ]) {
    const body = actionBody(name);
    assert.match(body, /role/);
    assert.match(body, /"client"/);
  }
});
