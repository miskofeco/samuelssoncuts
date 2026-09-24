import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

function loadTypeScript(filename, cache = new Map()) {
  const absolute = path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const javascript = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = new Module(absolute);
  loaded.filename = absolute;
  loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
  cache.set(absolute, loaded);
  loaded.require = (specifier) => specifier.startsWith(".")
    ? loadTypeScript(`${path.resolve(path.dirname(absolute), specifier)}.ts`, cache)
    : Module.createRequire(absolute)(specifier);
  loaded._compile(javascript, absolute);
  return loaded.exports;
}

const { reminderWindowFor } = loadTypeScript("src/server/reminder-window.ts");
const { claimReminder, reminderStillCurrent, releaseReminderClaim } =
  loadTypeScript("src/server/reminder-claim.ts");

test("daily reminder window includes the rest of today and all of tomorrow", () => {
  assert.deepEqual(reminderWindowFor(new Date("2026-09-24T08:00:00.000Z"), "Europe/Bratislava"), {
    todayShop: "2026-09-24",
    tomorrowShop: "2026-09-25",
    startIso: "2026-09-24T08:00:00.000Z",
    endIso: "2026-09-25T22:00:00.000Z",
  });
});

test("reminder window uses shop midnight across daylight saving change", () => {
  assert.deepEqual(reminderWindowFor(new Date("2026-10-24T08:00:00.000Z"), "Europe/Bratislava"), {
    todayShop: "2026-10-24",
    tomorrowShop: "2026-10-25",
    startIso: "2026-10-24T08:00:00.000Z",
    endIso: "2026-10-25T23:00:00.000Z",
  });
});

function fakeSupabase(result = { data: { id: "appt" }, error: null }) {
  const calls = [];
  const query = Object.fromEntries(["update", "select", "eq", "gt", "lt", "is", "maybeSingle"]
    .map((method) => [method, (...args) => {
      calls.push([method, ...args]);
      return method === "maybeSingle" ? Promise.resolve(result) : query;
    }]));
  return { calls, from: (table) => {
    calls.push(["from", table]);
    return query;
  } };
}

const appointment = {
  id: "appt",
  starts_at: "2026-09-25T08:00:00.000Z",
  client_id: "client",
  service_id: "service",
};

test("claim checks current status, slot, owner, and due bounds atomically", async () => {
  const db = fakeSupabase();
  const result = await claimReminder(db, appointment,
    "2026-09-24T08:00:00.000Z", "2026-09-25T22:00:00.000Z");
  assert.equal(result.claimed, true);
  assert.deepEqual(db.calls, [
    ["from", "appointments"],
    ["update", { reminded_at: "2026-09-24T08:00:00.000Z" }],
    ["eq", "id", "appt"],
    ["eq", "status", "confirmed"],
    ["eq", "starts_at", appointment.starts_at],
    ["eq", "client_id", "client"],
    ["eq", "service_id", "service"],
    ["gt", "starts_at", "2026-09-24T08:00:00.000Z"],
    ["lt", "starts_at", "2026-09-25T22:00:00.000Z"],
    ["is", "reminded_at", null],
    ["select", "id"],
    ["maybeSingle"],
  ]);
});

test("freshness check and failed-send release target the original claim", async () => {
  const db = fakeSupabase();
  assert.equal((await reminderStillCurrent(db, appointment, "2026-09-24T08:00:00.000Z",
    "2026-09-24T08:00:01.000Z")).current, true);
  assert.deepEqual(db.calls.slice(0, 8), [
    ["from", "appointments"],
    ["select", "id"],
    ["eq", "id", "appt"],
    ["eq", "status", "confirmed"],
    ["eq", "starts_at", appointment.starts_at],
    ["eq", "client_id", "client"],
    ["eq", "service_id", "service"],
    ["eq", "reminded_at", "2026-09-24T08:00:00.000Z"],
  ]);
  const releaseDb = fakeSupabase({ data: null, error: null });
  await releaseReminderClaim(releaseDb, "appt", "2026-09-24T08:00:00.000Z");
  assert.deepEqual(releaseDb.calls.slice(0, 4), [
    ["from", "appointments"],
    ["update", { reminded_at: null }],
    ["eq", "id", "appt"],
    ["eq", "reminded_at", "2026-09-24T08:00:00.000Z"],
  ]);
});
