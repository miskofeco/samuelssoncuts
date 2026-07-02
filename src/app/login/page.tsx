import Link from "next/link";

import { signInAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth/auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Field } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { getDict } from "@/i18n/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const t = await getDict();

  return (
    <AuthPanel error={params.error} message={params.message} mode="login">
      <form action={signInAction} className="space-y-4">
        <Field
          required
          label={t.common.email}
          name="email"
          type="email"
          placeholder={t.auth.emailPlaceholder}
        />
        <Field
          required
          label={t.auth.passwordLabel}
          name="password"
          type="password"
          placeholder={t.auth.passwordPlaceholder}
        />
        <SubmitButton className="w-full" pendingLabel={t.common.sending}>
          {t.auth.signIn}
        </SubmitButton>
        <p className="text-center text-sm">
          <Link
            href="/reset-password"
            className="font-semibold text-stone-600 underline-offset-4 hover:underline dark:text-stone-400"
          >
            {t.auth.forgotPassword}
          </Link>
        </p>
      </form>
      <OAuthButtons />
    </AuthPanel>
  );
}
