"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { markNotificationReadAction, markNotificationsReadAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
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
      disabled={pending || !hasUnread}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction();
          router.refresh();
        })
      }
    >
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
      className="min-h-7 px-2 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationReadAction(notificationId);
          router.refresh();
        })
      }
    >
      {t.client.markRead}
    </Button>
  );
}
