import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const cronRoute = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const bookingGuards = readFileSync("src/server/booking-guards.ts", "utf8");

test("reminder cron fails closed when CRON_SECRET is not configured", () => {
  assert.match(cronRoute, /if \(!secret\)/);
  assert.match(cronRoute, /Cron secret is not configured/);
  assert.match(cronRoute, /status: 503/);
});

test("booking-producing actions use shared server-side availability guards", () => {
  assert.match(bookingGuards, /export async function guardSlot/);
  assert.match(bookingGuards, /hasBlockedTimeOverlap/);
  assert.match(bookingGuards, /hasConfirmedAppointmentOverlap/);
  assert.match(bookingGuards, /isSlotInsideConfiguredBusinessHours/);
  assert.match(actions, /createBookingRequestAction[\s\S]*guardSlot/);
  assert.match(actions, /confirmRequestAction[\s\S]*guardSlot/);
  assert.match(actions, /respondToProposalAction[\s\S]*guardSlot/);
});

test("business-hours updates are validated server-side without stale type casts", () => {
  assert.match(actions, /const businessHoursSchema = z\.array/);
  assert.match(actions, /saveBusinessHoursAction[\s\S]*businessHoursSchema\.safeParse/);
  assert.doesNotMatch(actions, /rows as never\[\]/);
});

test("database migrations reject overlapping confirmed appointments", () => {
  const migrationFiles = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const migrations = migrationFiles
    .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
    .join("\n");

  assert.match(migrations, /btree_gist/);
  assert.match(migrations, /appointments_no_confirmed_overlap/);
  assert.match(migrations, /tstzrange\(starts_at, ends_at, '\[\)'\)/);
  assert.match(migrations, /where \(status = 'confirmed'\)/);
});
