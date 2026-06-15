import { Card, SectionHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import type { Notification } from "@/domain/types";

export function NotificationList({
  notifications,
  title = "Notifications",
  maxHeight = "max-h-[420px]",
}: {
  notifications: Notification[];
  title?: string;
  maxHeight?: string;
}) {
  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader title={title} action={<StatusPill>{notifications.length}</StatusPill>} />
      <div className={`mt-4 space-y-2 overflow-auto pr-1 ${maxHeight}`}>
        {notifications.length === 0 ? (
          <EmptyState title="No notifications yet" />
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className="rounded-xl border border-black/10 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-stone-900"
            >
              <div className="flex items-center justify-between gap-3">
                <StatusPill tone={notification.channel === "SMS" ? "info" : "neutral"}>
                  {notification.channel}
                </StatusPill>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {notification.createdAt}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-black dark:text-white">
                {notification.subject}
              </p>
              <p className="break-all text-xs text-stone-500 dark:text-stone-400">
                {notification.to}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
