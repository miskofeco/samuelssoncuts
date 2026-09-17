"use client";

import { TaskDone01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { markNotificationReadAction, markNotificationsReadAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { useT } from "@/i18n/provider";

// "Mark all read" control for the notifications page. Server action clears the
// unread flag and revalidates /client, which refreshes both this list and the
// nav badge. Disabled when there's nothing unread.
export function MarkReadButton({ hasUnread }: { hasUnread: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={!hasUnread}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction();
          router.refresh();
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationReadAction(notificationId);
          router.refresh();
        })
      }
    >
      {pending ? null : <Icon icon={Tick02Icon} className="size-3.5" strokeWidth={2.2} />}
      {t.client.markRead}
    </Button>
  );
}
