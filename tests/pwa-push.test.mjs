import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
  .join("\n");

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const packageJson = read("package.json");
const env = read("src/lib/env.ts");
const databaseTypes = read("src/lib/database.types.ts");
const serviceWorker = read("public/sw.js");
const appShell = read("src/components/layout/app-shell.tsx");
const badgeSync = read("src/components/shared/push-badge-sync.tsx");
const pushCard = read("src/components/shared/push-notification-card.tsx");
const pushClient = read("src/lib/push-client.ts");
const publicKeyRoute = read("src/app/api/push/public-key/route.ts");
const subscriptionsRoute = read("src/app/api/push/subscriptions/route.ts");
const notifications = read("src/server/notifications.ts");
const actions = read("src/app/actions.ts");
const cron = read("src/app/api/cron/reminders/route.ts");
const proxy = read("src/proxy.ts");

test("push subscriptions table is RLS-scoped to the owning user", () => {
  assert.match(migrations, /create table if not exists public\.push_subscriptions/);
  assert.match(migrations, /endpoint text not null unique/);
  assert.match(migrations, /alter table public\.push_subscriptions enable row level security/);
  assert.match(migrations, /create policy "push_subscriptions own read"/);
  assert.match(migrations, /create policy "push_subscriptions own insert"/);
  assert.match(migrations, /with check \(user_id = auth\.uid\(\)\)/);
  assert.match(migrations, /create policy "push_subscriptions own delete"/);
  assert.match(databaseTypes, /push_subscriptions:/);
});

test("web push env and dependency are server-only", () => {
  assert.match(packageJson, /"web-push"/);
  assert.match(env, /getWebPushPublicKey/);
  assert.match(env, /getWebPushPrivateKey/);
  assert.match(env, /getWebPushSubject/);
  assert.match(env, /WEB_PUSH_PUBLIC_KEY/);
  assert.match(env, /WEB_PUSH_PRIVATE_KEY/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_WEB_PUSH_PRIVATE_KEY/);
});

test("push API routes require auth and same-origin subscription changes", () => {
  assert.match(publicKeyRoute, /getCurrentProfile\(\)/);
  assert.match(publicKeyRoute, /getWebPushPublicKey\(\)/);
  assert.doesNotMatch(publicKeyRoute, /getWebPushPrivateKey/);
  assert.match(subscriptionsRoute, /assertSameOrigin\(request\)/);
  assert.match(subscriptionsRoute, /getCurrentProfile\(\)/);
  assert.match(subscriptionsRoute, /status:\s*401/);
  assert.doesNotMatch(subscriptionsRoute, /redirect\(/);
  assert.match(subscriptionsRoute, /subscriptionSchema\.safeParse/);
  assert.match(subscriptionsRoute, /isAllowedPushEndpoint\(parsed\.data\.endpoint\)/);
  assert.match(subscriptionsRoute, /enforceRateLimit\("push-subscription"/);
  // Ownership reassignment happens inside the SECURITY DEFINER RPC (0032).
  assert.match(subscriptionsRoute, /rpc\("upsert_push_subscription"/);
  assert.doesNotMatch(subscriptionsRoute, /error\.message/);
  assert.match(subscriptionsRoute, /export async function DELETE/);
});

test("service worker handles push, notification clicks, and app badges without caching", () => {
  assert.match(serviceWorker, /self\.addEventListener\("push"/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /setAppBadge/);
  assert.match(serviceWorker, /clearAppBadge/);
  assert.match(serviceWorker, /self\.addEventListener\("notificationclick"/);
  assert.match(serviceWorker, /clients\.openWindow/);
  assert.doesNotMatch(serviceWorker, /caches\.open/);
  assert.doesNotMatch(serviceWorker, /fetch"\s*,/);
});

test("app shell registers the service worker and syncs foreground badge counts", () => {
  assert.match(appShell, /<PushBadgeSync/);
  assert.match(appShell, /attention\?\.requests/);
  assert.match(appShell, /attention\?\.approvals/);
  assert.match(badgeSync, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(badgeSync, /navigator\.setAppBadge/);
  assert.match(badgeSync, /navigator\.clearAppBadge/);
  assert.match(badgeSync, /postMessage\(\{ type: "SET_BADGE"/);
});

test("account areas expose explicit opt-in controls", () => {
  const adminSettings = read("src/app/admin/settings/page.tsx");
  const clientNotifications = read("src/app/client/notifications/page.tsx");
  assert.match(adminSettings, /PushNotificationCard/);
  assert.match(clientNotifications, /PushNotificationCard/);
  assert.match(pushCard, /Notification\.requestPermission\(\)/);
  assert.match(pushCard, /pushManager\.subscribe/);
  assert.match(pushClient, /\/api\/push\/subscriptions/);
  assert.match(pushCard, /persistPushSubscription\(subscription\)/);
  assert.match(badgeSync, /persistPushSubscription\(subscription\)/);
  assert.match(badgeSync, /visibilitychange/);
  assert.match(pushCard, /pushManager\.getSubscription/);
});

test("notification creation is centralized and sends push non-fatally", () => {
  assert.match(notifications, /createNotification/);
  assert.match(notifications, /createNotifications/);
  assert.match(notifications, /sendPushToUser/);
  assert.match(notifications, /reportError\("push-notification"/);
  assert.match(notifications, /derivePushNotification/);
  assert.match(notifications, /isAllowedPushEndpoint\(subscription\.endpoint\)/);
  assert.match(notifications, /timeout: 5_000/);
  assert.doesNotMatch(actions, /\.from\("notifications"\)\.insert/);
  assert.doesNotMatch(cron, /\.from\("notifications"\)\.insert/);
});

test("CSP permits service workers and known web push endpoints", () => {
  assert.match(proxy, /worker-src 'self'/);
  // pushManager.subscribe is browser-internal; push service hosts do not belong in connect-src.
  assert.doesNotMatch(proxy, /push\.apple\.com|fcm\.googleapis\.com/);
});
