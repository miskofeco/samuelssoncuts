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

test("sidebar badge counts are computed server-side and refresh via revalidatePath", () => {
  // The counts come from loadAttentionCounts() (server) and are passed to the
  // sidebar as props, so they update immediately after an admin action (which
  // calls revalidatePath) — no manual reload needed. The realtime hook only
  // nudges a router.refresh() for background changes by other admins/clients.
  const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");
  const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf8");
  const sidebar = readFileSync("src/components/layout/sidebar.tsx", "utf8");
  assert.match(dashboardData, /export async function loadAttentionCounts/);
  assert.match(adminLayout, /loadAttentionCounts\(\)/);
  assert.match(sidebar, /attention\?\.requests/);
  assert.match(badgeHook, /export function useAttentionRefresh/);
  assert.match(badgeHook, /router\.refresh\(\)/);
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

test("modal traps focus and restores it on close (Radix Dialog)", () => {
  // Radix Dialog.Content wraps FocusScope (trap + return focus), DismissableLayer
  // (Escape/outside dismiss) and RemoveScroll (iOS-safe scroll lock), and wires
  // aria-labelledby/aria-describedby from Title/Description automatically.
  assert.match(modal, /<Dialog\.Content/);
  assert.match(modal, /<Dialog\.Title/);
  assert.match(modal, /<Dialog\.Description/);
  assert.match(modal, /<Dialog\.Close/);
});

test("clickable data-table rows are keyboard accessible without breaking table semantics", () => {
  // A real <button> in the first cell gives a Tab stop + Enter/Space activation;
  // `role="button"` on a <tr> is invalid ARIA and hides the row from table navigation.
  assert.doesNotMatch(dataTable, /role=\{onRowClick \? "button" : undefined\}/);
  assert.match(dataTable, /aria-label=\{rowLabel\?\.\(row\)\}/);
  assert.match(dataTable, /mobileCard/);
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
