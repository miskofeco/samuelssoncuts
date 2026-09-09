"use client";

import { BadgeCheck, Clock, Cookie, Shield, User, XCircle } from "lucide-react";
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

import { useAttentionRefresh } from "@/hooks/use-realtime-badge";
import type { AttentionCounts } from "@/server/dashboard-data";
import type { NavSection } from "./nav-items";

function isActive(pathname: string, href: string) {
  // Exact match for index routes, prefix match for sub-sections.
  if (href === "/admin" || href === "/client") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Sidebar badge counts for admin — pending booking requests and pending
// (email-confirmed) client registrations. The numbers come from the server via
// `attention` and refresh through revalidatePath() after any admin action, so
// they update immediately without a manual reload. Realtime is a live-update
// nudge for changes made by OTHER admins/clients.
export function Sidebar({
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
  const isAdmin = profile.role === "admin";

  return isAdmin ? (
    <SidebarWithBadges sections={sections} profile={profile} attention={attention} />
  ) : (
    <SidebarInner
      sections={sections}
      profile={profile}
      requests={0}
      approvals={0}
      unread={unreadNotifications ?? 0}
    />
  );
}

function SidebarWithBadges({
  sections,
  profile,
  attention,
}: {
  sections: NavSection[];
  profile: AuthProfile;
  attention?: AttentionCounts;
}) {
  // Refresh the server components (and thus these counts) when a booking request
  // or profile changes in the background. The counts themselves are the
  // server-provided `attention` values.
  useAttentionRefresh();
  return (
    <SidebarInner
      sections={sections}
      profile={profile}
      requests={attention?.requests ?? 0}
      approvals={attention?.approvals ?? 0}
      unread={0}
    />
  );
}

function SidebarInner({
  sections,
  profile,
  requests,
  approvals,
  unread,
}: {
  sections: NavSection[];
  profile: AuthProfile;
  requests: number;
  approvals: number;
  unread: number;
}) {
  const pathname = usePathname();
  const t = useT();
  const { openPreferences } = useConsent();

  function badgeFor(href: string): number {
    if (href === "/admin/requests") return requests;
    if (href === "/admin/approvals") return approvals;
    if (href === "/client/notifications") return unread;
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
              <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
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
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white",
                      active
                        ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                        : "text-stone-600 hover:bg-stone-100 hover:text-black dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white",
                    )}
                  >
                    <span className={cn("flex size-5 items-center justify-center [&_svg]:size-4", active ? "" : "text-stone-500 dark:text-stone-400")}>
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
          className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-black dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white"
        >
          <Cookie className="size-3.5" aria-hidden />
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

const iconClass = "size-4";

function ShieldIcon() {
  return <Shield className={iconClass} aria-hidden />;
}

function UserIcon() {
  return <User className={iconClass} aria-hidden />;
}

function VerifiedIcon() {
  return <BadgeCheck className={iconClass} aria-hidden />;
}

function ClockIcon() {
  return <Clock className={iconClass} aria-hidden />;
}

function XIcon() {
  return <XCircle className={iconClass} aria-hidden />;
}
