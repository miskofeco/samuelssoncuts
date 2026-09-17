"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/shared/avatar";
import { Icon } from "@/components/shared/icon";
import { Logo } from "@/components/shared/logo";
import { Sheet } from "@/components/shared/sheet";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useT } from "@/i18n/provider";
import type { AuthProfile } from "@/server/auth";
import { cn } from "@/lib/classnames";

import { AccountPanel } from "./account-panel";
import {
  MOBILE_TAB_LIMIT,
  badgeFor,
  flattenNav,
  formatBadge,
  isNavActive,
  type NavCounts,
  type NavItem,
  type NavSection,
} from "./nav-items";

/**
 * Phone navigation (below md): a slim top bar (logo, theme, account) and a
 * fixed bottom tab bar with the primary destinations. When a role has more
 * than four destinations the tail moves under a "More" bottom sheet; the
 * account sheet holds language, theme, cookie preferences and sign-out.
 */
export function MobileNav({
  sections,
  profile,
  counts,
}: {
  sections: NavSection[];
  profile: AuthProfile;
  counts: NavCounts;
}) {
  const t = useT();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close sheets when the route changes (adjust state during render — React's
  // recommended alternative to a setState-in-effect).
  if ((moreOpen || accountOpen) && openedAt !== pathname) {
    setMoreOpen(false);
    setAccountOpen(false);
  }

  const items = flattenNav(sections);
  const needsMore = items.length > MOBILE_TAB_LIMIT + 1;
  const tabs = needsMore ? items.slice(0, MOBILE_TAB_LIMIT) : items;
  const overflow = needsMore ? items.slice(MOBILE_TAB_LIMIT) : [];
  const overflowActive = overflow.some((item) => isNavActive(pathname, item.href));
  const overflowBadge = overflow.reduce((sum, item) => sum + badgeFor(item, counts), 0);

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-background/85 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-xl">
        <Link href="/dashboard" className="flex min-w-0 items-center" aria-label="Samuelsson Cuts">
          <Logo className="h-6 max-w-full shrink" priority />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle className="size-9" />
          <button
            type="button"
            onClick={() => {
              setOpenedAt(pathname);
              setAccountOpen(true);
            }}
            aria-label={t.nav.accountMenu}
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" className="size-9" />
          </button>
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav
        aria-label={t.nav.primaryNavigation}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        <ul
          className="grid h-(--spacing-bottom-nav) items-stretch"
          style={{ gridTemplateColumns: `repeat(${tabs.length + (needsMore ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {tabs.map((item) => (
            <li key={item.href} className="min-w-0">
              <TabLink item={item} active={isNavActive(pathname, item.href)} count={badgeFor(item, counts)} />
            </li>
          ))}
          {needsMore ? (
            <li className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setOpenedAt(pathname);
                  setMoreOpen(true);
                }}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={tabClass(overflowActive)}
              >
                <span className="relative">
                  <Icon icon={MoreHorizontalIcon} className="size-6" strokeWidth={overflowActive ? 2.2 : 1.8} />
                  {overflowBadge > 0 ? <TabBadge count={overflowBadge} /> : null}
                </span>
                <span className="line-clamp-2 max-w-full text-center text-[0.65rem] leading-[1.1] font-semibold">
                  {t.nav.more}
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      <Sheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={t.nav.more}
        description={t.nav.moreDescription}
        side="bottom"
        showTitle
      >
        <ul className="grid grid-cols-2 gap-2">
          {overflow.map((item) => {
            const active = isNavActive(pathname, item.href);
            const count = badgeFor(item, counts);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-20 flex-col justify-between gap-2 rounded-xl p-3 text-sm font-semibold ring-1 ring-foreground/10 transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]",
                    active ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <Icon icon={item.icon} className="size-5" />
                    {count > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.65rem] font-bold text-white">
                        {formatBadge(count)}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate">{t.nav[item.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <Sheet
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title={t.nav.accountMenu}
        description={profile.email}
        side="bottom"
        showTitle
      >
        <AccountPanel profile={profile} showPreferences />
      </Sheet>
    </div>
  );
}

function tabClass(active: boolean) {
  return cn(
    "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-muted-foreground outline-none transition-colors select-none focus-visible:bg-muted active:bg-muted/70",
    active && "text-foreground",
  );
}

function TabLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  const t = useT();
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      <span className="relative">
        <Icon icon={item.icon} className="size-6" strokeWidth={active ? 2.2 : 1.8} />
        {count > 0 ? <TabBadge count={count} /> : null}
      </span>
      <span className="line-clamp-2 max-w-full text-center text-[0.65rem] leading-[1.1] font-semibold">
        {t.nav[item.key]}
      </span>
    </Link>
  );
}

function TabBadge({ count }: { count: number }) {
  return (
    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold text-white ring-2 ring-background">
      {formatBadge(count)}
    </span>
  );
}
