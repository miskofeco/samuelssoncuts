"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { useConsent } from "@/components/consent/consent-provider";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { IconBadge } from "@/components/shared/icon-badge";
import { Logo } from "@/components/shared/logo";
import { useT } from "@/i18n/provider";
import type { AuthProfile } from "@/server/auth";
import { cn } from "@/lib/classnames";

import { useRealtimeBadge } from "@/hooks/use-realtime-badge";
import type { NavSection } from "./nav-items";

function isActive(pathname: string, href: string) {
  // Exact match for index routes, prefix match for sub-sections.
  if (href === "/admin" || href === "/client") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Live badge counts for admin — new booking requests and new client registrations.
function AdminBadges() {
  const requests = useRealtimeBadge("booking_requests", "/admin/requests");
  const approvals = useRealtimeBadge("profiles", "/admin/approvals");
  return { requests, approvals };
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
  const { openPreferences } = useConsent();
  const isAdmin = profile.role === "admin";
  const badges = isAdmin ? AdminBadges() : { requests: 0, approvals: 0 };

  function badgeFor(href: string): number {
    if (href === "/admin/requests") return badges.requests;
    if (href === "/admin/approvals") return badges.approvals;
    return 0;
  }

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
                    <span className="flex-1">{t.nav[item.key]}</span>
                    {badgeFor(item.href) > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
                        {badgeFor(item.href) > 99 ? "99+" : badgeFor(item.href)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-black dark:text-white">
              {profile.full_name}
            </p>
            <p className="truncate text-xs text-stone-500 dark:text-stone-400">
              {profile.email}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {profile.role === "admin" ? (
            <IconBadge
              tone="info"
              icon={<ShieldIcon />}
              label={t.account.roleAdminHint}
            />
          ) : (
            <IconBadge
              tone="neutral"
              icon={<UserIcon />}
              label={t.account.roleClientHint}
            />
          )}
          {profile.approval_status === "approved" ? (
            <IconBadge
              tone="success"
              icon={<VerifiedIcon />}
              label={t.account.verifiedHint}
            />
          ) : profile.approval_status === "rejected" || profile.approval_status === "blocked" ? (
            <IconBadge
              tone="danger"
              icon={<XIcon />}
              label={profile.approval_status === "blocked" ? t.account.blockedHint : t.account.rejectedHint}
            />
          ) : (
            <IconBadge
              tone="warning"
              icon={<ClockIcon />}
              label={t.account.approvalPendingHint}
            />
          )}
        </div>
        <button
          type="button"
          onClick={openPreferences}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-black dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z" />
            <path d="M8.5 8.5v.01M16 12v.01M12 16v.01" />
          </svg>
          {t.nav.cookiePreferences}
        </button>
        <form action={signOutAction} className="mt-3">
          <Button type="submit" variant="secondary" className="w-full">
            {t.common.signOut}
          </Button>
        </form>
      </div>
    </div>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// Barber/admin: shield. Client: person.
function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// Approved: filled badge-check (the green "verified" mark). The fill comes from
// the IconBadge success tone; we draw a solid disc with a white tick on top.
function VerifiedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.39 1.74 2.96-.01 1.07 2.76 2.4 1.73-.55 2.91.55 2.91-2.4 1.73-1.07 2.76-2.96-.01L12 22l-2.39-1.72-2.96.01-1.07-2.76-2.4-1.73L3.74 12l-.56-2.78 2.4-1.73L6.65 4.73l2.96.01L12 2z" />
      <path
        d="M9 12.5l2 2 4-4.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}
