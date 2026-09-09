"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/shared/logo";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Sheet } from "@/components/shared/sheet";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useT } from "@/i18n/provider";
import type { AuthProfile } from "@/server/auth";
import type { AttentionCounts } from "@/server/dashboard-data";
import type { NavSection } from "./nav-items";
import { Sidebar } from "./sidebar";

export function MobileNav({
  sections,
  profile,
  attention,
  unreadNotifications,
}: {
  sections: NavSection[];
  profile: AuthProfile;
  attention?: AttentionCounts;
  unreadNotifications?: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);
  const badgeCount = (attention?.requests ?? 0) + (attention?.approvals ?? 0) + (unreadNotifications ?? 0);

  // Close the drawer when the route changes (adjust state during render —
  // React's recommended alternative to a setState-in-effect).
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-black/10 bg-white/85 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/85">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setOpenedAt(pathname);
              setOpen(true);
            }}
            aria-label={t.common.openMenu}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-black/10 text-stone-700 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <Menu className="size-5" aria-hidden />
            {badgeCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </button>
          <Logo className="h-6 max-w-full shrink" priority />
          <span className="sr-only">Samuelsson Cuts</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* The drawer mounts a second Sidebar instance; see CLAUDE.md about
          per-mount realtime channel names. */}
      <Sheet open={open} onOpenChange={setOpen} title={t.common.menu} side="left">
        <Sidebar
          sections={sections}
          profile={profile}
          attention={attention}
          unreadNotifications={unreadNotifications}
        />
      </Sheet>
    </div>
  );
}
