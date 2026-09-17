"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/shared/button";
import { useT } from "@/i18n/provider";

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

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.consent.banner.title}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="ss-banner-in mx-auto w-full max-w-3xl rounded-2xl border border-black/10 bg-white/95 p-3 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/95 sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h2 className="text-base font-semibold text-black dark:text-white">
              {t.consent.banner.title}
            </h2>
            <p className="mt-1 text-sm leading-5 text-stone-600 line-clamp-2 dark:text-stone-300 sm:line-clamp-none sm:leading-6">
              {t.consent.banner.body}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold sm:text-sm">
              <Link
                href="/cookies"
                className="text-black underline underline-offset-4 dark:text-white"
              >
                {t.consent.banner.policyLink}
              </Link>
              <Link
                href="/privacy"
                className="text-black underline underline-offset-4 dark:text-white"
              >
                {t.consent.banner.privacyLink}
              </Link>
              <Link
                href="/terms"
                className="text-black underline underline-offset-4 dark:text-white"
              >
                {t.consent.banner.termsLink}
              </Link>
              <Button
                variant="link"
                size="sm"
                onClick={openPreferences}
                className="h-auto min-h-0 p-0 text-xs sm:text-sm"
              >
                {t.consent.banner.customize}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button variant="secondary" onClick={rejectAll}>
              {t.consent.banner.rejectAll}
            </Button>
            <Button variant="secondary" onClick={acceptAll}>
              {t.consent.banner.acceptAll}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
