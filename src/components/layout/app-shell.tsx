import { cookies } from "next/headers";
import type { CSSProperties, ReactNode } from "react";

import { LanguageToggle } from "@/components/shared/language-toggle";
import { PushBadgeSync } from "@/components/shared/push-badge-sync";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getDict } from "@/i18n/server";
import type { AuthProfile } from "@/server/auth";
import type { AttentionCounts } from "@/server/dashboard-data";

import { AttentionRefresh } from "./attention-refresh";
import { MobileNav } from "./mobile-nav";
import { adminNav, clientNav, type NavCounts } from "./nav-items";
import { AppSidebar } from "./sidebar";

/**
 * Authenticated workspace frame. Desktop (md+) gets a collapsible sidebar and a
 * slim utility header; phones get a top bar plus a bottom tab bar. Badge counts
 * are server-computed and refreshed by `revalidatePath` after admin actions;
 * `AttentionRefresh` is the single realtime nudge for other users' changes.
 */
export async function AppShell({
  role,
  profile,
  attention,
  unreadNotifications,
  children,
}: {
  role: "admin" | "client";
  profile: AuthProfile;
  // Server-computed sidebar badge counts (admin only). Undefined for clients.
  attention?: AttentionCounts;
  // Server-computed unread notification count (client only).
  unreadNotifications?: number;
  children: ReactNode;
}) {
  const t = await getDict();
  const sections = role === "admin" ? adminNav : clientNav;
  const counts: NavCounts = {
    requests: attention?.requests ?? 0,
    approvals: attention?.approvals ?? 0,
    unread: unreadNotifications ?? 0,
  };
  const badgeCount = role === "admin" ? counts.requests + counts.approvals : counts.unread;
  const sidebarCookie = (await cookies()).get("sidebar_state")?.value;
  const sidebarOpen = sidebarCookie ? sidebarCookie === "true" : true;

  return (
    <SidebarProvider
      defaultOpen={sidebarOpen}
      // Wider icon rail than shadcn's 3rem so 40px buttons sit with breathing room.
      style={{ "--sidebar-width-icon": "4rem" } as CSSProperties}
    >
      <PushBadgeSync badgeCount={badgeCount} />
      {role === "admin" ? <AttentionRefresh /> : null}

      <AppSidebar sections={sections} profile={profile} counts={counts} />

      <SidebarInset className="min-w-0 bg-background">
        <MobileNav sections={sections} profile={profile} counts={counts} />

        {/* Desktop utility bar */}
        <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl md:flex lg:px-6">
          <SidebarTrigger className="-ml-1 size-9" aria-label={t.nav.collapseSidebar} />
          <div className="flex-1" />
          <LanguageToggle className="h-9 *:h-9" />
          <ThemeToggle className="size-9" />
        </header>

        <div className="flex-1 px-4 pt-4 pb-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom)+1.5rem)] sm:px-6 md:pt-6 md:pb-10 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
