import type { Metadata } from "next";

import { LegalPage } from "@/components/shared/legal-page";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: `${t.legal.privacy.title} · ${t.metadata.title}` };
}

export default async function PrivacyPage() {
  const t = await getDict();
  const lang = await getLang();
  const lastUpdated = new Intl.DateTimeFormat(localeFor(lang), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(LEGAL_LAST_UPDATED));

  return (
    <LegalPage
      content={t.legal.privacy}
      backLabel={t.legal.backToApp}
      lastUpdatedLabel={t.legal.lastUpdatedLabel}
      lastUpdated={lastUpdated}
    />
  );
}
