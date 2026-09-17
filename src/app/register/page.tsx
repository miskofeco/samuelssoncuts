import { registerAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth/auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Field, PasswordField } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { getDict } from "@/i18n/server";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const t = await getDict();

  return (
    <AuthPanel error={params.error} mode="register">
      <form action={registerAction} className="space-y-4">
        <Field
          required
          label={t.common.fullName}
          name="fullName"
          autoComplete="name"
          placeholder={t.auth.namePlaceholder}
        />
        <Field
          required
          label={t.common.email}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={params.email}
          placeholder={t.auth.emailPlaceholder}
        />
        <Field
          required
          label={t.common.phone}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t.auth.phonePlaceholder}
        />
        <PasswordField
          required
          label={t.auth.passwordLabel}
          name="password"
          autoComplete="new-password"
          minLength={8}
          hint={t.auth.passwordHint}
          placeholder={t.auth.passwordPlaceholder}
        />
        <SubmitButton className="w-full" pendingLabel={t.common.sending}>
          {t.auth.createAccount}
        </SubmitButton>
      </form>
      <OAuthButtons />
    </AuthPanel>
  );
}
