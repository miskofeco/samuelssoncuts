import { updatePasswordAction } from "@/app/actions";
import { Card } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Logo } from "@/components/shared/logo";
import { SubmitButton } from "@/components/shared/submit-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getDict } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
          {t.auth.updateTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {t.auth.updateSubtitle}
        </p>

        {params.error ? (
          <Feedback result={{ ok: false, error: params.error }} className="mt-4" />
        ) : null}

        <form action={updatePasswordAction} className="mt-5 space-y-4">
          <Field
            required
            label={t.auth.newPasswordLabel}
            name="password"
            type="password"
            placeholder={t.auth.passwordPlaceholder}
          />
          <SubmitButton className="w-full" pendingLabel={t.common.sending}>
            {t.auth.updateCta}
          </SubmitButton>
        </form>
      </Card>
    </main>
  );
}
