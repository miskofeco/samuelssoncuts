"use client";

import { CookieIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Icon } from "@/components/shared/icon";
import { useT } from "@/i18n/provider";

import { useConsent } from "./consent-provider";

// Re-entry point for the cookie preferences, used on the settings and profile
// pages. Withdrawing or changing consent must be as easy as giving it.
export function OpenPreferencesCard() {
  const t = useT();
  const { openPreferences } = useConsent();

  return (
    <Card>
      <SectionHeader title={t.consent.modal.title} description={t.consent.modal.intro} />
      <Button variant="outline" onClick={openPreferences} className="mt-4 w-full sm:w-auto">
        <Icon icon={CookieIcon} />
        {t.nav.cookiePreferences}
      </Button>
    </Card>
  );
}
