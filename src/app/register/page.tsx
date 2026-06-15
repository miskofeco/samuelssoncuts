import { registerAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth/auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/shared/button";
import { Field } from "@/components/shared/form";
import { getDict } from "@/i18n/server";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
          placeholder={t.auth.namePlaceholder}
        />
        <Field
          required
          label={t.common.email}
          name="email"
          type="email"
          placeholder={t.auth.emailPlaceholder}
        />
        <Field required label={t.common.phone} name="phone" placeholder={t.auth.phonePlaceholder} />
        <Field
          required
          label={t.auth.passwordLabel}
          name="password"
          type="password"
          placeholder={t.auth.passwordPlaceholder}
        />
        <Button type="submit" className="w-full">
          {t.auth.createAccount}
        </Button>
      </form>
      <OAuthButtons />
    </AuthPanel>
  );
}
