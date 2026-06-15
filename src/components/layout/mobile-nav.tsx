"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useT } from "@/i18n/provider";
import type { AuthProfile } from "@/server/auth";
import type { NavSection } from "./nav-items";
import { Sidebar } from "./sidebar";

export function MobileNav({
  sections,
  profile,
}: {
  sections: NavSection[];
  profile: AuthProfile;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close the drawer when the route changes (adjust state during render —
  // React's recommended alternative to a setState-in-effect).
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function openDrawer() {
    setOpenedAt(pathname);
    setOpen(true);
  }

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-white/85 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/85">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={openDrawer}
            aria-label={t.common.openMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 text-stone-700 dark:border-white/10 dark:text-stone-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <Logo className="h-6 max-w-full shrink" priority />
          <span className="sr-only">Samuelsson Cuts</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-[82%] max-w-xs overflow-y-auto bg-white p-4 shadow-2xl dark:bg-stone-900">
            <Sidebar sections={sections} profile={profile} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
