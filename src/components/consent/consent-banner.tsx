"use client";

import { CookieIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

import { useConsent } from "./consent-provider";

// First-visit consent bar, fixed to the bottom and shown until a decision is
// made (so it also covers logged-out /login, /register). Accept all / Reject all
// carry equal visual weight (a best-practice requirement); Manage preferences
// opens the granular modal.
export function ConsentBanner() {
  const t = useT();
  const pathname = usePathname();
  const { bannerOpen, acceptAll, rejectAll, openPreferences } = useConsent();

  // Hide on pages where the fixed banner would cover the content being reviewed.
  if (
    pathname === "/cookies" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/email-preview"
  ) {
    return null;
  }
  if (!bannerOpen) return null;

  // Inside the authenticated shell phones show a bottom tab bar; lift the
  // banner above it so neither covers the other. Public pages sit flush with
  // the safe area instead.
  const inAppShell = pathname.startsWith("/admin") || pathname.startsWith("/client");

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.consent.banner.title}
      className={cn(
        "fixed inset-x-0 z-50 px-3 sm:px-4",
        inAppShell
          ? "bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] pb-2 md:bottom-0 md:pb-4"
          : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4",
      )}
    >
      <div className="ss-banner-in mx-auto w-full max-w-3xl rounded-2xl bg-card/95 p-4 text-card-foreground shadow-lg shadow-black/10 ring-1 ring-foreground/10 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground sm:flex">
              <Icon icon={CookieIcon} className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Icon icon={CookieIcon} className="size-[18px] sm:hidden" />
                {t.consent.banner.title}
              </h2>
              <p className="mt-1 line-clamp-3 text-sm leading-5 text-muted-foreground sm:line-clamp-none sm:leading-6">
                {t.consent.banner.body}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs font-semibold sm:gap-x-4 sm:text-sm">
                <Link href="/cookies" className="inline-flex min-h-7 items-center text-foreground underline underline-offset-4">
                  {t.consent.banner.policyLink}
                </Link>
                <Link href="/privacy" className="inline-flex min-h-7 items-center text-foreground underline underline-offset-4">
                  {t.consent.banner.privacyLink}
                </Link>
                <Link href="/terms" className="inline-flex min-h-7 items-center text-foreground underline underline-offset-4">
                  {t.consent.banner.termsLink}
                </Link>
                <Button
                  variant="link"
                  size="sm"
                  onClick={openPreferences}
                  className="h-7 min-h-0 p-0 text-xs sm:text-sm"
                >
                  {t.consent.banner.customize}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button variant="outline" size="lg" onClick={rejectAll} className="sm:h-10 sm:text-sm">
              {t.consent.banner.rejectAll}
            </Button>
            <Button variant="outline" size="lg" onClick={acceptAll} className="sm:h-10 sm:text-sm">
              {t.consent.banner.acceptAll}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
