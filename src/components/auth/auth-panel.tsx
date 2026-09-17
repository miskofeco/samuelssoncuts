"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Icon, type IconSource } from "@/components/shared/icon";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

/**
 * Full-height public page frame: a top utility row with the language/theme
 * toggles (never overlapping content) and a vertically centred card column.
 * Shared by the auth, account-status and setup pages.
 */
export function AuthFrame({
  children,
  width = "md",
  className,
}: {
  children: ReactNode;
  /** Card width: `md` for forms, `lg` for status pages, `xl` for setup notes. */
  width?: "md" | "lg" | "xl";
  className?: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="flex items-center justify-end gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        <Card
          className={cn(
            "w-full rounded-2xl p-5 sm:p-8",
            width === "md" && "max-w-md",
            width === "lg" && "max-w-lg",
            width === "xl" && "max-w-2xl",
            className,
          )}
        >
          {children}
        </Card>
      </div>
    </main>
  );
}

const illustrationTones = {
  neutral: "bg-muted text-foreground",
  warning: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  info: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
} as const;

/** Rounded icon tile used as the status illustration on non-form pages. */
export function AuthIllustration({
  icon,
  tone = "neutral",
  className,
}: {
  icon: IconSource;
  tone?: keyof typeof illustrationTones;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl ring-1 ring-foreground/10",
        illustrationTones[tone],
        className,
      )}
    >
      <Icon icon={icon} className="size-6" />
    </div>
  );
}

/** Logo + title + subtitle block that opens every card in the frame. */
export function AuthHeading({
  title,
  description,
  eyebrow,
  illustration,
  aside,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  illustration?: ReactNode;
  /** Optional element aligned to the right of the logo row (e.g. a StatusPill). */
  aside?: ReactNode;
}) {
  const t = useT();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Logo className="h-9 sm:h-10" priority />
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <span className="sr-only">{t.auth.srTitle}</span>
      {illustration ? <div className="mt-6">{illustration}</div> : null}
      {eyebrow ? (
        <p className={cn("text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase", illustration ? "mt-4" : "mt-6")}>
          {eyebrow}
        </p>
      ) : null}
      <h1
        className={cn(
          "text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]",
          eyebrow ? "mt-1" : illustration ? "mt-4" : "mt-6",
        )}
      >
        {title}
      </h1>
      {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** Inline text link with a comfortable tap target. */
export function AuthLink({
  href,
  children,
  muted = false,
  className,
  prefetch,
}: {
  href: string;
  children: ReactNode;
  muted?: boolean;
  className?: string;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        "inline-flex min-h-10 items-center rounded-md font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
        muted ? "text-muted-foreground hover:text-foreground" : "text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function AuthPanel({
  children,
  error,
  message,
  mode,
}: {
  children: ReactNode;
  error?: string;
  message?: string;
  mode: "login" | "register";
}) {
  const t = useT();

  return (
    <AuthFrame>
      <AuthHeading
        title={mode === "login" ? t.auth.welcomeBack : t.auth.requestAccess}
        description={mode === "login" ? t.auth.loginSubtitle : t.auth.registerSubtitle}
      />

      {error ? <Feedback result={{ ok: false, error }} className="mt-5" /> : null}
      {message ? <Feedback result={{ ok: true, message }} className="mt-5" /> : null}

      <div className="mt-6">{children}</div>

      <p className="mt-6 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
        {mode === "login" ? t.auth.needAccess : t.auth.alreadyApproved}
        <AuthLink href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? t.auth.registerLink : t.auth.signInLink}
        </AuthLink>
      </p>
    </AuthFrame>
  );
}
