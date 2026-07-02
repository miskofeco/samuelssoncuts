import type { ReactNode } from "react";

import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { AuthProfile } from "@/server/auth";
import type { AttentionCounts } from "@/server/dashboard-data";

import { MobileNav } from "./mobile-nav";
import { adminNav, clientNav } from "./nav-items";
import { Sidebar } from "./sidebar";

export function AppShell({
  role,
  profile,
  attention,
  children,
}: {
  role: "admin" | "client";
  profile: AuthProfile;
  // Server-computed sidebar badge counts (admin only). Undefined for clients.
  attention?: AttentionCounts;
  children: ReactNode;
}) {
  const sections = role === "admin" ? adminNav : clientNav;

  return (
    <div className="desktop-zoom app-surface min-h-screen text-stone-950 dark:text-stone-100">
      {/* Mobile top bar + drawer */}
      <MobileNav sections={sections} profile={profile} attention={attention} />

      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar — fixed full height */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-black/10 bg-white/80 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/70 lg:block">
          <Sidebar sections={sections} profile={profile} attention={attention} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop utility bar */}
          <div className="hidden items-center justify-end gap-2 px-6 pt-5 lg:flex xl:px-10">
            <LanguageToggle />
            <ThemeToggle />
          </div>

          <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:pt-4">
            <div className="mx-auto w-full max-w-[1500px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
