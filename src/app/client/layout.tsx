import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireApprovedClient } from "@/server/auth";
import { loadUnreadNotificationCount } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const profile = await requireApprovedClient();
  const unreadNotifications = await loadUnreadNotificationCount(profile);

  return (
    <AppShell role="client" profile={profile} unreadNotifications={unreadNotifications}>
      {children}
    </AppShell>
  );
}
