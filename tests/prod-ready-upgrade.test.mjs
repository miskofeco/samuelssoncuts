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
  const appShell = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  assert.match(dashboardData, /export async function loadAttentionCounts/);
  assert.match(adminLayout, /loadAttentionCounts\(\)/);
  // The shell maps the server counts into nav badges for both navigations.
  assert.match(appShell, /requests: attention\?\.requests \?\? 0/);
  assert.match(appShell, /approvals: attention\?\.approvals \?\? 0/);
  assert.match(badgeHook, /export function useAttentionRefresh/);
  assert.match(badgeHook, /router\.refresh\(\)/);
});

test("service image upload failure keeps the modal open and surfaces the error", () => {
  const saveBody = serviceManager.slice(
    serviceManager.indexOf("async function save("),
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
  // The shadcn Dialog/Drawer parts wrap Radix Dialog.Content (FocusScope trap +
  // return focus, DismissableLayer for Escape/outside dismiss, RemoveScroll for
  // an iOS-safe scroll lock) and wire aria-labelledby/aria-describedby from
  // Title/Description automatically; vaul does the same on the phone drawer.
  assert.match(modal, /<DialogContent/);
  assert.match(modal, /<DialogTitle/);
  assert.match(modal, /<DialogDescription/);
  assert.match(modal, /<DialogClose/);
  assert.match(modal, /<DrawerTitle/);
  assert.match(modal, /<DrawerDescription/);
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
  // Errors travel as short codes resolved on the login page, never as free text.
  assert.match(authCallback, /authErrorPath\("\/login", reason\)/);
  assert.match(authCallback, /fail\("oauth_failed"\)/);
});

test("approval queue confirms rejection and only disables the active row", () => {
  assert.match(approvalQueue, /busyIds\.has\(client\.id\)/);
  assert.match(approvalQueue, /disabled=\{busy\}/);
  assert.match(approvalQueue, /<ConfirmDialog/);
  assert.doesNotMatch(approvalQueue, /disabled=\{pendingTransition\}/);
});

test("notification or-filter is guarded against delimiter-bearing emails", () => {
  assert.match(dashboardData, /function notificationOrFilter/);
  assert.match(dashboardData, /\/\[,\(\)"'\]\/\.test\(email\)/);
});
