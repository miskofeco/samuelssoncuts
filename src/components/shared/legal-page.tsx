import Link from "next/link";

import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";

// Renders a legal document (Privacy / Terms) from a localized content object.
// Mirrors the structure of the cookie policy page so all legal pages look
// consistent and stay fully bilingual via the passed-in dictionary strings.
export type LegalContent = {
  title: string;
  intro: string;
  sections: ReadonlyArray<{ heading: string; body: string }>;
};

export function LegalPage({
  content,
  backLabel,
  lastUpdatedLabel,
  lastUpdated,
}: {
  content: LegalContent;
  backLabel: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
}) {
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
          ← {backLabel}
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-black dark:text-white">
          {content.title}
        </h1>
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          {lastUpdatedLabel}: {lastUpdated}
        </p>

        <p className="mt-6 text-sm leading-7 text-stone-700 dark:text-stone-300">
          {content.intro}
        </p>

        {content.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-lg font-semibold text-black dark:text-white">
              {section.heading}
            </h2>
            <p className="mt-2 text-sm leading-7 text-stone-700 dark:text-stone-300">
              {section.body}
            </p>
          </section>
        ))}
      </article>
    </main>
  );
}
