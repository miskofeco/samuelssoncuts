"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Logo } from "@/components/shared/logo";
import { StatusPill } from "@/components/shared/status-pill";
import { useT } from "@/i18n/provider";
import type { AuthProfile } from "@/server/auth";
import { cn } from "@/lib/classnames";

import type { NavSection } from "./nav-items";

function isActive(pathname: string, href: string) {
  // Exact match for index routes, prefix match for sub-sections.
  if (href === "/admin" || href === "/client") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  sections,
  profile,
}: {
  sections: NavSection[];
  profile: AuthProfile;
}) {
  const pathname = usePathname();
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="block px-2 py-1">
        <Logo className="h-8 lg:h-12" priority />
        <span className="sr-only">Samuelsson Cuts</span>
      </Link>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto">
        {sections.map((section, index) => (
          <div key={section.headingKey ?? index}>
            {section.headingKey ? (
              <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
                {t.nav[section.headingKey]}
              </p>
            ) : null}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                      active
                        ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                        : "text-stone-600 hover:bg-stone-100 hover:text-black dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white",
                    )}
                  >
                    <span className={cn(active ? "" : "text-stone-400 dark:text-stone-500")}>
                      {item.icon}
                    </span>
                    {t.nav[item.key]}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-black dark:text-white">
              {profile.full_name}
            </p>
            <p className="truncate text-xs text-stone-500 dark:text-stone-400">
              {profile.email}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill>{profile.role}</StatusPill>
          <StatusPill
            tone={profile.approval_status === "approved" ? "success" : "warning"}
          >
            {profile.approval_status}
          </StatusPill>
        </div>
        <form action={signOutAction} className="mt-3">
          <Button type="submit" variant="secondary" className="w-full">
            {t.common.signOut}
          </Button>
        </form>
      </div>
    </div>
  );
}
