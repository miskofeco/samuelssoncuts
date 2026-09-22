"use client";

import { TaskDone01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useTransition } from "react";
import { toast } from "sonner";

import { markNotificationReadAction, markNotificationsReadAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { useT } from "@/i18n/provider";

// "Mark all read" control for the notifications page. Server action clears the
// unread flag and revalidates /client, which refreshes both this list and the
// nav badge. Disabled when there's nothing unread.
export function MarkReadButton({ hasUnread }: { hasUnread: boolean }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={!hasUnread}
      loading={pending}
      className="min-h-11 w-full sm:min-h-9 sm:w-auto"
      onClick={() =>
        startTransition(async () => {
          try {
            await markNotificationsReadAction();
          } catch {
            toast.error(t.common.somethingWentWrong);
          }
        })
      }
    >
      {pending ? null : <Icon icon={TaskDone01Icon} className="size-4" strokeWidth={2} />}
      {t.client.markAllRead}
    </Button>
  );
}

export function MarkNotificationReadButton({ notificationId }: { notificationId: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="ml-auto min-h-11 min-w-11 shrink-0 px-0 text-xs text-muted-foreground hover:text-foreground sm:ml-0 sm:min-h-8 sm:min-w-0 sm:px-2"
      title={t.client.markRead}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markNotificationReadAction(notificationId);
          } catch {
            toast.error(t.common.somethingWentWrong);
          }
        })
      }
    >
      {pending ? null : <Icon icon={Tick02Icon} className="size-3.5" strokeWidth={2.2} />}
      <span className="sr-only sm:not-sr-only">{t.client.markRead}</span>
    </Button>
  );
}
