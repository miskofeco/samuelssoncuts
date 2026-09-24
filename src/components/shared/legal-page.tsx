import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { cn } from "@/lib/classnames";

// Renders a legal document (Privacy / Terms) from a localized content object.
// The cookie policy page reuses `LegalShell` + `LegalSection` so all legal
// pages share one article layout and stay fully bilingual via the passed-in
// dictionary strings.
export type LegalContent = {
  title: string;
  intro: string;
  sections: ReadonlyArray<{ heading: string; body: string }>;
};

/**
 * Article frame for legal documents: a sticky top bar (back link + language and
 * theme toggles) above a readable `max-w-3xl` column.
 */
export function LegalShell({
  backLabel,
  title,
  meta,
  intro,
  children,
}: {
  backLabel: string;
  title: string;
  /** Small print under the title (version, last-updated date). */
  meta?: ReactNode;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <ButtonLink href="/" variant="ghost" className="-ml-2 text-muted-foreground hover:text-foreground">
            <Icon icon={ArrowLeft01Icon} />
            {backLabel}
          </ButtonLink>
          <div className="flex items-center gap-2">
            <LanguageToggle className="h-9 *:h-9" />
            <ThemeToggle className="size-9" />
          </div>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-4 pt-8 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12 sm:pb-20">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        {meta ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{meta}</div>
        ) : null}
        <p className="mt-6 text-base leading-7 text-foreground/90 sm:text-[1.0625rem] sm:leading-8">{intro}</p>
        <div className="mt-10 space-y-10">{children}</div>
      </article>
    </main>
  );
}

/** One heading + body block inside `LegalShell`. Pass children for custom bodies. */
export function LegalSection({
  title,
  body,
  children,
  className,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("scroll-mt-20", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
      {body ? <p className="mt-3 text-[0.9375rem] leading-7 text-muted-foreground">{body}</p> : null}
      {children}
    </section>
  );
}

export function LegalPage({
  content,
  backLabel,
  lastUpdatedLabel,
  lastUpdated,
  contactPhone,
  contactAddress,
}: {
  content: LegalContent;
  backLabel: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  contactPhone?: string | null;
  contactAddress?: string | null;
}) {
  return (
    <LegalShell
      backLabel={backLabel}
      title={content.title}
      meta={
        <span>
          {lastUpdatedLabel}: {lastUpdated}
        </span>
      }
      intro={content.intro}
    >
      {content.sections.map((section, index) => (
        <LegalSection key={section.heading} title={section.heading} body={section.body}>
          {index === content.sections.length - 1 && (contactPhone || contactAddress) ? (
            <div className="mt-3 space-y-1 text-sm text-foreground">
              {contactPhone ? (
                <a className="block font-medium text-primary underline underline-offset-4"
                  href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}>
                  {contactPhone}
                </a>
              ) : null}
              {contactAddress ? <p>{contactAddress}</p> : null}
            </div>
          ) : null}
        </LegalSection>
      ))}
    </LegalShell>
  );
}
