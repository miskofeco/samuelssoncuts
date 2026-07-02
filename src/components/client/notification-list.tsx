import Link from "next/link";

import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import type { Notification } from "@/domain/types";
import { getDict } from "@/i18n/server";
import { cn } from "@/lib/classnames";

// Read-only presentational list of notifications. Shows the message body when
// present, an unread accent + pill for unread items, and (for booking-related
// updates) a deep link to the reservations page. The full-page variant with the
// "mark all read" control is NotificationCenter (a client component).
export async function NotificationList({
  notifications,
  title,
  maxHeight = "max-h-[420px]",
  action,
}: {
  notifications: Notification[];
  title?: string;
  maxHeight?: string;
  action?: React.ReactNode;
}) {
  const t = await getDict();
  const unreadCount = notifications.filter((n) => !n.read).length;
  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        title={title ?? t.client.notificationsTitle}
        action={action ?? <StatusPill>{unreadCount > 0 ? unreadCount : notifications.length}</StatusPill>}
      />
      <div className={`mt-4 space-y-2 overflow-auto pr-1 ${maxHeight}`}>
        {notifications.length === 0 ? (
          <EmptyState title={t.client.noNotifications} />
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                notification.read
                  ? "border-black/10 bg-white dark:border-white/10 dark:bg-stone-900"
                  : "border-sky-200 bg-sky-50/60 dark:border-sky-500/30 dark:bg-sky-500/10",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {!notification.read ? (
                    <StatusPill tone="info">{t.client.unreadLabel}</StatusPill>
                  ) : (
                    <StatusPill tone={notification.channel === "SMS" ? "info" : "neutral"}>
                      {notification.channel}
                    </StatusPill>
                  )}
                </div>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {notification.createdAt}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-black dark:text-white">
                {notification.subject}
              </p>
              {notification.body ? (
                <p className="mt-1 whitespace-pre-line text-sm text-stone-600 dark:text-stone-300">
                  {notification.body}
                </p>
              ) : null}
              <Link
                href="/client/reservations"
                className="mt-2 inline-block text-xs font-semibold text-sky-700 underline underline-offset-4 dark:text-sky-400"
              >
                {t.client.viewReservations}
              </Link>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
