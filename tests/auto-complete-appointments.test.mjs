import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

async function loadOutcomesModule() {
  try {
    return await import("../src/server/appointment-outcomes.ts");
  } catch (error) {
    assert.fail(`expected appointment outcome automation module to exist: ${error.message}`);
  }
}

test("auto-complete cutoff is exactly two hours before the cron run", async () => {
  const { AUTO_COMPLETE_GRACE_HOURS, autoCompleteCutoffIso } = await loadOutcomesModule();

  assert.equal(AUTO_COMPLETE_GRACE_HOURS, 2);
  assert.equal(
    autoCompleteCutoffIso(new Date("2026-07-24T15:30:00.000Z")),
    "2026-07-24T13:30:00.000Z",
  );
});

test("auto-complete update only touches finished confirmed appointments without an outcome", async () => {
  const { autoCompleteFinishedAppointments } = await loadOutcomesModule();
  const calls = [];
  const builder = {
    update(value, options) {
      calls.push(["update", value, options]);
      return this;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      return this;
    },
    is(column, value) {
      calls.push(["is", column, value]);
      return this;
    },
    lte(column, value) {
      calls.push(["lte", column, value]);
      return this;
    },
    select(columns, options) {
      calls.push(["select", columns, options]);
      return Promise.resolve({ count: 3, error: null });
    },
  };
  const supabase = {
    from(table) {
      calls.push(["from", table]);
      return builder;
    },
  };

  const result = await autoCompleteFinishedAppointments(
    supabase,
    new Date("2026-07-24T15:30:00.000Z"),
  );

  assert.deepEqual(result, { completed: 3 });
  assert.deepEqual(calls, [
    ["from", "appointments"],
    ["update", { outcome: "completed" }, { count: "exact" }],
    ["eq", "status", "confirmed"],
    ["is", "outcome", null],
    ["lte", "ends_at", "2026-07-24T13:30:00.000Z"],
    ["select", "id", undefined],
  ]);
});

test("stale pending requests and sent proposals are closed after their start", async () => {
  const { expireStaleBookingState } = await loadOutcomesModule();
  const calls = [];
  const counts = { booking_requests: 2, appointment_proposals: 3 };
  const supabase = {
    from(table) {
      calls.push(["from", table]);
      const builder = {
        update(value, options) {
          calls.push(["update", table, value, options]);
          return builder;
        },
        eq(column, value) {
          calls.push(["eq", table, column, value]);
          return builder;
        },
        lt(column, value) {
          calls.push(["lt", table, column, value]);
          return builder;
        },
        select(columns) {
          calls.push(["select", table, columns]);
          return Promise.resolve({ count: counts[table], error: null });
        },
      };
      return builder;
    },
  };

  const result = await expireStaleBookingState(
    supabase,
    new Date("2026-07-24T15:30:00.000Z"),
  );

  assert.deepEqual(result, { declinedRequests: 2, expiredProposals: 3 });
  assert.deepEqual(calls, [
    ["from", "booking_requests"],
    ["update", "booking_requests", { status: "declined" }, { count: "exact" }],
    ["eq", "booking_requests", "status", "pending"],
    ["lt", "booking_requests", "requested_start", "2026-07-24T15:30:00.000Z"],
    ["select", "booking_requests", "id"],
    ["from", "appointment_proposals"],
    ["update", "appointment_proposals", { status: "expired" }, { count: "exact" }],
    ["eq", "appointment_proposals", "status", "sent"],
    ["lt", "appointment_proposals", "starts_at", "2026-07-24T15:30:00.000Z"],
    ["select", "appointment_proposals", "id"],
  ]);
});

test("daily reminders cron route also runs the outcome sweep and reports the counts", () => {
  const route = read("src/app/api/cron/reminders/route.ts");

  assert.match(route, /getCronSecret/);
  assert.match(route, /Authorization|authorization/);
  assert.match(route, /autoCompleteFinishedAppointments/);
  assert.match(route, /expireStaleBookingState/);
  assert.match(route, /completed,\s*declinedRequests,\s*expiredProposals/);
  assert.ok(
    !existsSync("src/app/api/cron/complete-appointments/route.ts"),
    "the separate complete-appointments cron route must be removed",
  );
});

test("Vercel cron config has a single daily job (Hobby plan allows once per day only)", () => {
  const vercel = JSON.parse(read("vercel.json"));

  assert.equal(vercel.crons.length, 1);
  assert.equal(vercel.crons[0].path, "/api/cron/reminders");
  assert.match(vercel.crons[0].schedule, /^\d+ \d+ \* \* \*$/);
});

test("database has a partial index for pending outcome completion sweeps", () => {
  const migrations = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
    .join("\n");

  assert.match(migrations, /appointments_auto_complete_outcome_idx/);
  assert.match(migrations, /on public\.appointments \(ends_at\)/);
  assert.match(migrations, /where status = 'confirmed' and outcome is null/);
});
