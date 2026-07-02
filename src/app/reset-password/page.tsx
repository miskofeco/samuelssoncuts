import Link from "next/link";

import { requestPasswordResetAction } from "@/app/actions";
import { Card } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Logo } from "@/components/shared/logo";
import { SubmitButton } from "@/components/shared/submit-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getDict } from "@/i18n/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const t = await getDict();

  return (
    <main className="desktop-zoom app-surface grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md rounded-2xl p-6 sm:p-7">
        <Logo className="h-10" priority />
        <span className="sr-only">{t.auth.srTitle}</span>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-black dark:text-white">
          {t.auth.resetTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {t.auth.resetSubtitle}
        </p>

        {params.error ? (
          <Feedback result={{ ok: false, error: params.error }} className="mt-4" />
        ) : null}
        {params.message ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300">
            {params.message}
          </p>
        ) : null}

        <form action={requestPasswordResetAction} className="mt-5 space-y-4">
          <Field
            required
            label={t.common.email}
            name="email"
            type="email"
            placeholder={t.auth.emailPlaceholder}
          />
          <SubmitButton className="w-full" pendingLabel={t.common.sending}>
            {t.auth.resetCta}
          </SubmitButton>
        </form>

        <p className="mt-5 text-sm text-stone-600 dark:text-stone-400">
          <Link
            href="/login"
            className="font-semibold text-black underline-offset-4 hover:underline dark:text-white"
          >
            {t.auth.backToLogin}
          </Link>
        </p>
      </Card>
    </main>
  );
}
