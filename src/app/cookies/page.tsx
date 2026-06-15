import type { Metadata } from "next";
import Link from "next/link";

import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
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

  return (
    <main className="desktop-zoom app-surface min-h-screen px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <article className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="text-sm font-semibold text-stone-600 underline-offset-4 hover:underline dark:text-stone-400"
        >
          ← {policy.backToApp}
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-black dark:text-white">
          {policy.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
          <span>{t.consent.modal.version(CONSENT_VERSION)}</span>
          <span>{t.consent.modal.lastUpdated(lastUpdated)}</span>
        </div>

        <p className="mt-6 text-sm leading-7 text-stone-700 dark:text-stone-300">
          {policy.intro}
        </p>

        <Section title={policy.whatTitle} body={policy.whatBody} />
        <Section title={policy.howTitle} body={policy.howBody} />

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-black dark:text-white">
            {policy.categoriesTitle}
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-stone-500 dark:border-white/10 dark:text-stone-400">
                  <th className="py-2 pr-3 font-semibold">{policy.tableCategory}</th>
                  <th className="py-2 pr-3 font-semibold">{policy.tablePurpose}</th>
                  <th className="py-2 pr-3 font-semibold">{policy.tableExamples}</th>
                  <th className="py-2 font-semibold">{policy.tableStatus}</th>
                </tr>
              </thead>
              <tbody>
                {ALL_CATEGORIES.map((key) => {
                  const cat = t.consent.categories[key];
                  return (
                    <tr
                      key={key}
                      className="border-b border-black/5 align-top dark:border-white/5"
                    >
                      <td className="py-3 pr-3 font-semibold text-black dark:text-white">
                        {cat.name}
                      </td>
                      <td className="py-3 pr-3 text-stone-600 dark:text-stone-400">
                        {cat.description}
                      </td>
                      <td className="py-3 pr-3 text-stone-600 dark:text-stone-400">
                        {cat.cookies}
                      </td>
                      <td className="py-3 text-stone-600 dark:text-stone-400">
                        {cat.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <Section title={policy.manageTitle} body={policy.manageBody} />
        <Section title={policy.retentionTitle} body={policy.retentionBody} />
        <Section title={policy.legalTitle} body={policy.legalBody} />
        <Section title={policy.contactTitle} body={policy.contactBody} />
      </article>
    </main>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-black dark:text-white">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-stone-700 dark:text-stone-300">{body}</p>
    </section>
  );
}
