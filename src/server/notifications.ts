import "server-only";

import { after } from "next/server";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getSiteUrl, getWebPushEnv } from "@/lib/env";
import { getShopBarberEmail } from "@/server/shop-barber";
import { reportError } from "@/lib/observability";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PushCopy } from "@/domain/push-copy";
import { derivePushNotification } from "@/server/push-payloads";

type Supabase = SupabaseClient<Database>;
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];

export type NotificationInput = NotificationInsert & {
  pushUserIds?: string[];
  pushUrl?: string;
  /** Structured lock-screen copy; never derived from the free-text `body`. */
  push?: PushCopy;
};

let vapidConfigured = false;

function configureWebPush() {
  const env = getWebPushEnv();
  if (!env) return null;

  if (!vapidConfigured) {
    webpush.setVapidDetails(env.subject, env.publicKey, env.privateKey);
    vapidConfigured = true;
  }

  return env;
}

async function approvedAdminIds(): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("approval_status", "approved");

  if (error) {
    await reportError("push-notification", error, { phase: "admin-ids" });
    return [];
  }

  return (data ?? []).map((profile) => profile.id);
}

async function badgeCountForUser(userId: string): Promise<{ count: number; role: "admin" | "client" }> {
  const supabase = getSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { count: 0, role: "client" };
  }

  if (profile.role === "admin") {
    const [requestsResult, approvalsResult] = await Promise.all([
      supabase
        .from("booking_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending")
        .not("email_confirmed_at", "is", null)
        .not("phone", "is", null),
    ]);

    return {
      role: "admin",
      count: (requestsResult.count ?? 0) + (approvalsResult.count ?? 0),
    };
  }

  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  query = profile.email && !/[,()"']/.test(profile.email)
    ? query.or(`user_id.eq.${userId},recipient.eq.${profile.email}`)
    : query.eq("user_id", userId);

  const { count } = await query;
  return { role: "client", count: count ?? 0 };
}

function absoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}

function isGoneStatus(error: unknown) {
  const statusCode = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : 0;
  return statusCode === 404 || statusCode === 410;
}

async function markPushSuccess(subscription: PushSubscriptionRow) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("push_subscriptions")
    .update({
      failure_count: 0,
      last_success_at: new Date().toISOString(),
      last_failure_at: null,
      enabled: true,
    })
    .eq("id", subscription.id);
}

async function markPushFailure(subscription: PushSubscriptionRow, error: unknown) {
  const supabase = getSupabaseAdminClient();
  if (isGoneStatus(error)) {
    await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
    return;
  }

  await supabase
    .from("push_subscriptions")
    .update({
      failure_count: subscription.failure_count + 1,
      last_failure_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);
}

export async function sendPushToUser(
  userId: string,
  notification: { subject: string; body?: string | null; push?: PushCopy | null },
  options: { url?: string; tag?: string } = {},
) {
  if (!configureWebPush()) return;

  const supabase = getSupabaseAdminClient();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error) {
    await reportError("push-notification", error, { userId, phase: "load-subscriptions" });
    return;
  }

  if (!subscriptions?.length) return;

  const { count, role } = await badgeCountForUser(userId);
  const fallbackUrl = role === "admin" ? "/admin" : "/client/notifications";
  const payload = JSON.stringify(
    derivePushNotification(notification, {
      badgeCount: count,
      url: absoluteUrl(options.url ?? fallbackUrl),
      tag: options.tag,
    }),
  );

  for (let index = 0; index < subscriptions.length; index += 4) {
    await Promise.all(subscriptions.slice(index, index + 4).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          {
            TTL: 60 * 60 * 24,
            urgency: "normal",
          },
        );
        await markPushSuccess(subscription);
      } catch (error) {
        await markPushFailure(subscription, error);
        await reportError("push-notification", error, {
          userId,
          endpoint: subscription.endpoint.slice(0, 80),
        });
      }
    }));
  }
}

async function sendPushToUsers(
  userIds: string[] | undefined,
  notification: NotificationInsert & { push?: PushCopy },
  pushUrl?: string,
) {
  const uniqueIds = [...new Set((userIds ?? []).filter(Boolean))];
  for (let index = 0; index < uniqueIds.length; index += 4) {
    await Promise.all(uniqueIds.slice(index, index + 4).map((userId) =>
      sendPushToUser(userId, notification, { url: pushUrl }),
    ));
  }
}

function toNotificationRow(notification: NotificationInput): NotificationInsert {
  const { pushUserIds: _pushUserIds, pushUrl, push: _push, ...row } = notification;
  void _pushUserIds;
  void _push;
  return { ...row, action_url: pushUrl ?? row.action_url ?? null };
}

export async function createNotification(
  supabase: Supabase,
  { pushUserIds, pushUrl, push, ...notification }: NotificationInput,
) {
  const { error } = await supabase
    .from("notifications")
    .insert({ ...notification, action_url: pushUrl ?? notification.action_url ?? null });
  if (error) {
    await reportError("notification-insert", error, { channel: notification.channel });
    return;
  }

  const fallbackUserIds = notification.user_id ? [notification.user_id] : [];
  after(() => sendPushToUsers(pushUserIds ?? fallbackUserIds, { ...notification, push }, pushUrl));
}

export async function createNotifications(
  supabase: Supabase,
  notifications: NotificationInput[],
) {
  if (notifications.length === 0) return;

  const rows = notifications.map(toNotificationRow);
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    await reportError("notification-insert", error, { count: notifications.length });
    return;
  }

  after(async () => {
    for (const notification of notifications) {
      const fallbackUserIds = notification.user_id ? [notification.user_id] : [];
      await sendPushToUsers(notification.pushUserIds ?? fallbackUserIds, notification, notification.pushUrl);
    }
  });
}

export async function createAdminNotification(
  notification: Omit<NotificationInsert, "user_id" | "recipient"> & {
    recipient?: string;
    pushUrl?: string;
    push?: PushCopy;
  },
) {
  const supabase = getSupabaseAdminClient();
  const pushUserIds = await approvedAdminIds();
  await createNotification(supabase, {
    ...notification,
    user_id: null,
    recipient: notification.recipient ?? await getShopBarberEmail(),
    pushUserIds,
    pushUrl: notification.pushUrl ?? "/admin",
  });
}
