import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
  .join("\n");

const actions = readFileSync("src/app/actions.ts", "utf8");
const audit = readFileSync("src/server/audit.ts", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
const supabaseProxy = readFileSync("src/lib/supabase/proxy.ts", "utf8");
const themeScript = readFileSync("src/components/shared/theme-script.tsx", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const instrumentation = readFileSync("src/instrumentation.ts", "utf8");
const observability = readFileSync("src/lib/observability.ts", "utf8");

test("notifications insert policy is scoped to self or admin (not with check true)", () => {
  assert.match(migrations, /create policy "notifications self or admin insert"/);
  assert.match(migrations, /with check \(user_id = auth\.uid\(\) or public\.is_admin\(\)\)/);
  assert.match(migrations, /drop policy if exists "notifications authenticated insert"/);
});

test("admin audit log table, RLS, and definer writer exist", () => {
  assert.match(migrations, /create table if not exists public\.admin_audit_log/);
  assert.match(migrations, /create policy "admin_audit_log admin read"/);
  assert.match(migrations, /create or replace function public\.record_admin_action/);
  assert.match(migrations, /if not public\.is_admin\(\) then/);
  // No direct INSERT policy — writes only via the definer function.
  assert.doesNotMatch(migrations, /admin_audit_log[\s\S]*for insert/);
});

test("privileged actions record an audit entry", () => {
  assert.match(audit, /rpc\("record_admin_action"/);
  for (const action of [
    "client.approve",
    "client.reject",
    "client.block",
    "client.unblock",
    "client.delete",
    "appointment.reschedule",
    "appointment.cancel",
  ]) {
    assert.match(actions, new RegExp(`recordAdminAction\\("${action.replace(".", "\\.")}"`));
  }
});

test("server errors are funneled through the instrumentation onRequestError hook", () => {
  assert.match(instrumentation, /export const onRequestError/);
  assert.match(instrumentation, /reportError\("request-error"/);
  assert.match(observability, /AbortSignal\.timeout/);
});

test("proxy sets a nonce-based CSP with strict-dynamic and Supabase origins", () => {
  assert.match(proxy, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.match(proxy, /frame-ancestors 'none'/);
  assert.match(proxy, /object-src 'none'/);
  assert.match(proxy, /connect-src 'self' \$\{supabaseHost\} \$\{supabaseWs\}/);
  assert.match(proxy, /wss:\/\//);
  assert.match(proxy, /btoa\(crypto\.randomUUID\(\)\)/);
});

test("nonce is threaded through the proxy response and into the inline theme script", () => {
  assert.match(supabaseProxy, /x-nonce/);
  assert.match(supabaseProxy, /Content-Security-Policy/);
  assert.match(layout, /headers\(\)\)\.get\("x-nonce"\)/);
  assert.match(layout, /<ThemeScript nonce=\{nonce\}/);
  assert.match(themeScript, /nonce\?: string/);
  assert.match(themeScript, /nonce=\{nonce\}/);
});
