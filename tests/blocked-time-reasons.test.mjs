import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("src/app/actions.ts", "utf8");
const manager = readFileSync("src/components/admin/availability-manager.tsx", "utf8");
const calendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const loader = readFileSync("src/server/dashboard-data.ts", "utf8");
const clientRoute = readFileSync("src/app/api/client/booking-availability/route.ts", "utf8");

test("a block needs a short reason on the server, in the form and in the database", () => {
  assert.match(actions, /reason: z\.string\(\)\.trim\(\)\.min\(BLOCK_REASON_MIN_LENGTH\)\.max\(BLOCK_REASON_MAX_LENGTH\)/);
  assert.match(actions, /reasonIssue \? t\.feedback\.blockReasonRequired : t\.feedback\.pickValidStartEnd/);
  assert.match(actions, /reason: parsed\.data\.reason,\n/);
  assert.match(manager, /maxLength=\{BLOCK_REASON_MAX_LENGTH\}/);
  assert.match(manager, /error=\{reasonTouched && !reasonValid \? t\.feedback\.blockReasonRequired : undefined\}/);
  assert.doesNotMatch(manager, /t\.admin\.reason\} \$\{t\.common\.optional\}/);
  const migration = readFileSync("supabase/migrations/0051_blocked_time_reason.sql", "utf8");
  assert.match(migration, /check \(reason is not null and char_length\(btrim\(reason\)\) between 2 and 40\)\s*not valid/);
});

test("block ranges use instant comparison and the list leads with the reason", () => {
  assert.match(loader, /const ranges = rows\.map\(\(row\) => blockedRangeFromRow\(row, window\)\)/);
  assert.doesNotMatch(loader, /rangeStartIso === shopDayRangeUtc/);
  assert.match(manager, /\{range\.reason \? \(\s*<p className="truncate text-sm font-semibold text-foreground">\{range\.reason\}<\/p>/);
  // The slice times use the shared quarter-hour combobox, not native inputs.
  assert.doesNotMatch(manager, /type="time"/);
});

test("reasons reach the admin calendar but never the client availability payload", () => {
  assert.match(loader, /\/\/ Admin-only payload: the calendar shows each block's reason\.\s*blockedIntervals: blocked\.labeledIntervals/);
  assert.equal((loader.match(/blockedIntervals: blocked\.intervals/g) ?? []).length >= 1, true);
  assert.match(clientRoute, /blockedIntervals: data\.blockedIntervals/);
  assert.match(calendar, /const blockReasonsFor = \(date: string\) => blockReasonsForDate\(date, blockedIntervals\)/);
  assert.match(calendar, /\{period\.reason && \(end - start\) >= 20 \? \(/);
  assert.match(calendar, /dayOff === "blocked" && blockReasonsFor\(day\)\.length > 0/);
  assert.match(calendar, /reasons\.length > 0 \? reasons\.join\(", "\) : t\.admin\.blockedShort/);
});

test("existing blocks without a usable reason are backfilled with Voľno", () => {
  const migration = readFileSync("supabase/migrations/0052_backfill_blocked_time_reason.sql", "utf8");
  assert.match(migration, /set reason = 'Voľno'\s*where reason is null or char_length\(btrim\(reason\)\) < 2;/);
  assert.match(migration, /validate constraint blocked_times_reason_short/);
});
