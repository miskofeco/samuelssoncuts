"use client";

import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { useT } from "@/i18n/provider";

import { useConsent } from "./consent-provider";

// Re-entry point for the cookie preferences, used on the settings and profile
// pages. Withdrawing or changing consent must be as easy as giving it.
export function OpenPreferencesCard() {
  const t = useT();
  const { openPreferences } = useConsent();

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-black dark:text-white">
        {t.consent.modal.title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-stone-600 dark:text-stone-400">
        {t.consent.modal.intro}
      </p>
      <Button
        variant="secondary"
        onClick={openPreferences}
        className="mt-4"
      >
        {t.nav.cookiePreferences}
      </Button>
    </Card>
  );
}
