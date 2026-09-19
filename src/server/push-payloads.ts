export type PushPayload = {
  title: string;
  body?: string;
  url: string;
  badgeCount: number;
  tag?: string;
};

// The free-text body (client notes, names in context) deliberately never
// reaches the push service: only the short subject travels off-platform.
export function derivePushNotification(
  notification: { subject: string; body?: string | null },
  options: { badgeCount: number; url: string; tag?: string },
): PushPayload {
  return {
    title: notification.subject,
    url: options.url,
    badgeCount: Math.max(0, options.badgeCount),
    tag: options.tag,
  };
}
