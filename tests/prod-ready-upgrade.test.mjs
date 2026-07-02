import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cronRoute = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");
const badgeHook = readFileSync("src/hooks/use-realtime-badge.ts", "utf8");
const serviceManager = readFileSync("src/components/admin/service-manager.tsx", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const modal = readFileSync("src/components/shared/modal.tsx", "utf8");
const dataTable = readFileSync("src/components/shared/data-table.tsx", "utf8");
const authCallback = readFileSync("src/app/auth/callback/route.ts", "utf8");
const approvalQueue = readFileSync("src/components/admin/approval-queue.tsx", "utf8");
const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");

test("reminder cron reads appointments with the service-role admin client (not the RLS-scoped anon client)", () => {
  // With no user session the anon client's auth.uid() is null, so the
  // appointments RLS policy returns zero rows and no reminders are ever sent.
  assert.match(cronRoute, /getSupabaseAdminClient/);
  assert.match(cronRoute, /const supabase = getSupabaseAdminClient\(\)/);
  assert.doesNotMatch(cronRoute, /from "@\/lib\/supabase\/server"/);
});

test("baseline security headers are configured", () => {
  assert.match(nextConfig, /async headers\(\)/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /Strict-Transport-Security/);
  assert.match(nextConfig, /Referrer-Policy/);
  assert.match(nextConfig, /Permissions-Policy/);
});

test("realtime badge subscription applies the same filter as the initial count", () => {
  assert.match(badgeHook, /filter: `\$\{filterColumn\}=eq\.\$\{filterValue\}`/);
});

test("service image upload failure keeps the modal open and surfaces the error", () => {
  const saveBody = serviceManager.slice(
    serviceManager.indexOf("async function save()"),
    serviceManager.indexOf("function toggle("),
  );
  assert.match(saveBody, /setUploadFeedback\(uploadResult\)/);
  assert.match(saveBody, /if \(!uploadResult\.ok\) return/);
});

test("client deletion is rate limited and returns a delete-specific message", () => {
  const deleteBody = actions.slice(
    actions.indexOf("export async function deleteClientAction"),
    actions.indexOf("export async function proposeAppointmentAction"),
  );
  assert.match(deleteBody, /enforceRateLimit\("admin:delete-client"/);
  assert.match(deleteBody, /t\.feedback\.clientDeleted/);
  assert.doesNotMatch(deleteBody, /return \{ ok: true, message: t\.feedback\.clientBlocked \}/);
});

test("modal traps focus and restores it on close", () => {
  assert.match(modal, /FOCUSABLE_SELECTOR/);
  assert.match(modal, /restoreFocusRef/);
  assert.match(modal, /function handleKeyDown/);
  assert.match(modal, /aria-describedby=/);
});

test("clickable data-table rows are keyboard accessible", () => {
  assert.match(dataTable, /role=\{onRowClick \? "button" : undefined\}/);
  assert.match(dataTable, /tabIndex=\{onRowClick \? 0 : undefined\}/);
  assert.match(dataTable, /event\.key === "Enter" \|\| event\.key === " "/);
});

test("oauth callback handles provider errors and failed code exchange", () => {
  assert.match(authCallback, /error_description/);
  assert.match(authCallback, /const \{ error \} = await supabase\.auth\.exchangeCodeForSession\(code\)/);
  assert.match(authCallback, /\/login\?error=/);
});

test("approval queue disables all row actions during any pending transition", () => {
  assert.match(approvalQueue, /if \(pendingTransition\) return/);
  assert.match(approvalQueue, /disabled=\{pendingTransition\}/);
});

test("notification or-filter is guarded against delimiter-bearing emails", () => {
  assert.match(dashboardData, /function notificationOrFilter/);
  assert.match(dashboardData, /\/\[,\(\)"'\]\/\.test\(email\)/);
});
