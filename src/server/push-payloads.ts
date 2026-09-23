import type { PushCopy } from "@/domain/push-copy";

export type PushPayload = {
  title: string;
  body?: string;
  url: string;
  badgeCount: number;
  tag?: string;
};

// Structured push copy (see `src/domain/push-copy.ts`) gives the lock screen a
// short action title and a detail body. Without it, only the in-app subject
// travels; the free-text notification body (client notes, admin reasons)
// deliberately never reaches the push service.
export function derivePushNotification(
  notification: { subject: string; body?: string | null; push?: PushCopy | null },
  options: { badgeCount: number; url: string; tag?: string },
): PushPayload {
  return {
    title: notification.push?.title ?? notification.subject,
    body: notification.push?.body || undefined,
    url: options.url,
    badgeCount: Math.max(0, options.badgeCount),
    tag: options.tag,
  };
}
