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

  // Hide on the full policy page so it doesn't cover the content the user came
  // to read — it reappears when they navigate back.
  if (pathname === "/cookies") return null;
  if (!bannerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.consent.banner.title}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/10 bg-white/95 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/95 sm:p-5">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-black dark:text-white">
              {t.consent.banner.title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-stone-600 dark:text-stone-400">
              {t.consent.banner.body}
            </p>
            <Link
              href="/cookies"
              className="mt-2 inline-block text-sm font-semibold text-black underline underline-offset-4 dark:text-white"
            >
              {t.consent.banner.policyLink}
            </Link>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={openPreferences}
              className="sm:order-1"
            >
              {t.consent.banner.customize}
            </Button>
            <Button
              variant="secondary"
              onClick={rejectAll}
              className="sm:order-2"
            >
              {t.consent.banner.rejectAll}
            </Button>
            <Button onClick={acceptAll} className="sm:order-3">
              {t.consent.banner.acceptAll}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
