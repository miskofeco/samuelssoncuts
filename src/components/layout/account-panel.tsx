"use client";

import {
  CheckmarkBadge01Icon,
  CancelCircleIcon,
  Clock01Icon,
  CookieIcon,
  Logout03Icon,
  ShieldUserIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import { signOutAction } from "@/app/actions";
import { useConsent } from "@/components/consent/consent-provider";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { IconBadge } from "@/components/shared/icon-badge";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/i18n/provider";
import type { AuthProfile } from "@/server/auth";
import { cn } from "@/lib/classnames";

/** Role and approval chips shown next to the signed-in user. */
export function ProfileBadges({ profile, className }: { profile: AuthProfile; className?: string }) {
  const t = useT();
  const status = profile.approval_status;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {profile.role === "admin" ? (
        <IconBadge tone="info" icon={<Icon icon={ShieldUserIcon} />} label={t.account.roleAdminHint} />
      ) : (
        <IconBadge tone="neutral" icon={<Icon icon={UserIcon} />} label={t.account.roleClientHint} />
      )}
      {status === "approved" ? (
        <IconBadge tone="success" icon={<Icon icon={CheckmarkBadge01Icon} />} label={t.account.verifiedHint} />
      ) : status === "rejected" || status === "blocked" ? (
        <IconBadge
          tone="danger"
          icon={<Icon icon={CancelCircleIcon} />}
          label={status === "blocked" ? t.account.blockedHint : t.account.rejectedHint}
        />
      ) : (
        <IconBadge tone="warning" icon={<Icon icon={Clock01Icon} />} label={t.account.approvalPendingHint} />
      )}
    </div>
  );
}

/**
 * Signed-in user summary plus account-level actions. Rendered in the desktop
 * sidebar footer and inside the phone account sheet (which also gets the
 * language and theme controls, since the phone header has no room for them).
 */
export function AccountPanel({
  profile,
  showPreferences = false,
  className,
}: {
  profile: AuthProfile;
  /** Include language + theme toggles (phone account sheet). */
  showPreferences?: boolean;
  className?: string;
}) {
  const t = useT();
  const { openPreferences } = useConsent();

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-3">
        <Avatar name={profile.full_name} src={profile.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{profile.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
        </div>
        <ProfileBadges profile={profile} />
      </div>

      {showPreferences ? (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">{t.language.label}</span>
            <LanguageToggle />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">{t.theme.dark}</span>
            <ThemeToggle />
          </div>
        </>
      ) : null}

      <Separator />

      <div className="flex flex-col gap-2">
        <Button variant="ghost" onClick={openPreferences} className="justify-start text-muted-foreground">
          <Icon icon={CookieIcon} />
          {t.nav.cookiePreferences}
        </Button>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">
            <Icon icon={Logout03Icon} />
            {t.common.signOut}
          </Button>
        </form>
      </div>
    </div>
  );
}
