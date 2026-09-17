import { signInAction } from "@/app/actions";
import { AuthLink, AuthPanel } from "@/components/auth/auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Field, PasswordField } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { getDict } from "@/i18n/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; email?: string }>;
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
          autoComplete="email"
          defaultValue={params.email}
          placeholder={t.auth.emailPlaceholder}
        />
        <PasswordField
          required
          label={t.auth.passwordLabel}
          name="password"
          autoComplete="current-password"
          minLength={8}
          hint={t.auth.passwordHint}
          placeholder={t.auth.passwordPlaceholder}
        />
        <SubmitButton size="lg" className="w-full" pendingLabel={t.common.sending}>
          {t.auth.signIn}
        </SubmitButton>
        <p className="flex justify-center text-sm">
          <AuthLink href="/reset-password" muted>
            {t.auth.forgotPassword}
          </AuthLink>
        </p>
      </form>
      <OAuthButtons />
    </AuthPanel>
  );
}
