import type { Metadata } from "next";

import { LegalSection, LegalShell } from "@/components/shared/legal-page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { ALL_CATEGORIES, CONSENT_LAST_UPDATED, CONSENT_VERSION } from "@/lib/consent/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: `${t.consent.policy.title} · ${t.metadata.title}` };
}

export default async function CookiePolicyPage() {
  const t = await getDict();
  const lang = await getLang();
  const lastUpdated = new Intl.DateTimeFormat(localeFor(lang), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(CONSENT_LAST_UPDATED));

  const policy = t.consent.policy;
  const categories = ALL_CATEGORIES.map((key) => ({ key, ...t.consent.categories[key] }));

  return (
    <LegalShell
      backLabel={policy.backToApp}
      title={policy.title}
      meta={
        <>
          <span>{t.consent.modal.version(CONSENT_VERSION)}</span>
          <span>{t.consent.modal.lastUpdated(lastUpdated)}</span>
        </>
      }
      intro={policy.intro}
    >
      <LegalSection title={policy.whatTitle} body={policy.whatBody} />
      <LegalSection title={policy.howTitle} body={policy.howBody} />

      <LegalSection title={policy.categoriesTitle}>
        {/* Phones: one card per category (a 4-column table does not fit). */}
        <ul className="mt-4 space-y-3 sm:hidden">
          {categories.map((cat) => (
            <li key={cat.key} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="text-sm font-semibold text-foreground">{cat.name}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{cat.description}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {policy.tableExamples}
                  </dt>
                  <dd className="mt-0.5 text-foreground/90">{cat.cookies}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {policy.tableStatus}
                  </dt>
                  <dd className="mt-0.5 text-foreground/90">{cat.status}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        {/* Tablet and up: the full comparison table. */}
        <div className="mt-4 hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 sm:block">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[16%] px-4 text-xs tracking-wide uppercase">{policy.tableCategory}</TableHead>
                <TableHead className="w-[40%] px-4 text-xs tracking-wide uppercase">{policy.tablePurpose}</TableHead>
                <TableHead className="px-4 text-xs tracking-wide uppercase">{policy.tableExamples}</TableHead>
                <TableHead className="px-4 text-xs tracking-wide uppercase">{policy.tableStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.key} className="hover:bg-transparent">
                  <TableCell className="px-4 py-3 align-top font-semibold whitespace-normal text-foreground">{cat.name}</TableCell>
                  <TableCell className="px-4 py-3 align-top leading-6 whitespace-normal text-muted-foreground">
                    {cat.description}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top leading-6 whitespace-normal text-muted-foreground">
                    {cat.cookies}
                  </TableCell>
                  <TableCell className="px-4 py-3 align-top leading-6 whitespace-normal text-muted-foreground">
                    {cat.status}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </LegalSection>

      <LegalSection title={policy.manageTitle} body={policy.manageBody} />
      <LegalSection title={policy.retentionTitle} body={policy.retentionBody} />
      <LegalSection title={policy.legalTitle} body={policy.legalBody} />
      <LegalSection title={policy.contactTitle} body={policy.contactBody} />
    </LegalShell>
  );
}
