import { ArrowRight01Icon, Mail01Icon, Message01Icon, Notification03Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";

import { MarkNotificationReadButton } from "@/components/client/mark-read-button";
import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Icon } from "@/components/shared/icon";
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
    <Card className="rounded-2xl">
      <SectionHeader
        title={title ?? t.client.notificationsTitle}
        action={
          action ?? (
            <StatusPill tone={unreadCount > 0 ? "info" : "neutral"} dot={unreadCount > 0}>
              {unreadCount > 0 ? unreadCount : notifications.length}
            </StatusPill>
          )
        }
      />
      <div className={cn("mt-4 overflow-auto", maxHeight)}>
        {notifications.length === 0 ? (
          <EmptyState icon={<Icon icon={Notification03Icon} />} title={t.client.noNotifications} />
        ) : (
          <ul className="divide-y">
            {notifications.map((notification) => {
              const unread = !notification.read;
              const channelIcon = notification.channel === "SMS" ? Message01Icon : Mail01Icon;
              return (
                <li
                  key={notification.id}
                  className={cn(
                    "-mx-2 flex gap-3 rounded-xl px-2 py-3 sm:-mx-3 sm:px-3",
                    unread && "bg-sky-500/6 dark:bg-sky-400/8",
                  )}
                >
                  <span
                    className={cn(
                      "relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      unread
                        ? "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon icon={channelIcon} className="size-[18px]" strokeWidth={unread ? 2 : 1.8} />
                    {unread ? (
                      <span
                        aria-hidden
                        className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sky-500 ring-2 ring-card"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={cn(
                          "min-w-0 text-sm text-foreground",
                          unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {notification.subject}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {notification.createdAt}
                      </span>
                    </div>
                    {notification.body ? (
                      <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                        {notification.body}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {unread ? (
                        <StatusPill tone="info" dot>
                          {t.client.unreadLabel}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral">{notification.channel}</StatusPill>
                      )}
                      {notification.actionUrl?.startsWith("/client/reservations") ? (
                        <Link
                          href={notification.actionUrl}
                          className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-sky-700 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-sky-400"
                        >
                          {t.client.viewReservations}
                          <Icon icon={ArrowRight01Icon} className="size-3.5" strokeWidth={2} />
                        </Link>
                      ) : null}
                      {unread ? (
                        <MarkNotificationReadButton notificationId={notification.id} />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
