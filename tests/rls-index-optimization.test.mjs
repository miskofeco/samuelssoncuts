import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authMigration = readFileSync("supabase/migrations/0038_auth_rls_initplans.sql", "utf8");
const adminMigration = readFileSync("supabase/migrations/0039_admin_rls_initplans.sql", "utf8");
const indexMigration = readFileSync("supabase/migrations/0040_missing_foreign_key_indexes.sql", "utf8");

test("RLS optimization preserves policies and only caches row-independent auth checks", () => {
  const sql = `${authMigration}\n${adminMigration}`;
  const statements = sql.replace(/^--.*$/gm, "");
  assert.equal((authMigration.match(/alter policy /gi) ?? []).length, 21);
  assert.equal((adminMigration.match(/alter policy /gi) ?? []).length, 8);
  assert.doesNotMatch(statements, /\b(drop|create)\s+policy\b|\bgrant\b|\brevoke\b|\bto\s+authenticated\b/i);
  assert.doesNotMatch(statements, /(?<!select )auth\.(?:uid|jwt)\(\)/i);
  assert.doesNotMatch(statements, /(?<!select )is_admin\(\)/i);
  assert.match(authMigration, /profiles self update/);
  assert.match(authMigration, /notifications own update/);
  assert.match(authMigration, /notifications self or admin insert/);
});

test("exactly five missing foreign-key columns gain narrow indexes", () => {
  const expected = [
    ["appointment_proposals", "barber_id"],
    ["appointments", "proposal_id"],
    ["appointments", "service_id"],
    ["booking_requests", "selected_proposal_id"],
    ["booking_requests", "service_id"],
  ];
  assert.equal((indexMigration.match(/create index /gi) ?? []).length, expected.length);
  for (const [table, column] of expected) {
    assert.match(indexMigration, new RegExp(`on public\\.${table} \\(${column}\\)`, "i"));
  }
  assert.doesNotMatch(indexMigration, /drop index|unique index|concurrently/i);
});
