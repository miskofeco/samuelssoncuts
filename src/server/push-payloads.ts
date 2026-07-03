export type BadgeCountInput = {
  role: "admin" | "client";
  attention?: { requests: number; approvals: number };
  unreadNotifications?: number;
};

export type PushPayload = {
  title: string;
  body?: string;
  url: string;
  badgeCount: number;
  tag?: string;
};

export function badgeCountForRole({
  role,
  attention,
  unreadNotifications,
}: BadgeCountInput): number {
  if (role === "admin") {
    return (attention?.requests ?? 0) + (attention?.approvals ?? 0);
  }

  return unreadNotifications ?? 0;
}

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
