import { LockIcon } from "@hugeicons/core-free-icons";

import { updatePasswordAction } from "@/app/actions";
import { AuthFrame, AuthHeading, AuthIllustration } from "@/components/auth/auth-panel";
import { Feedback } from "@/components/shared/feedback";
import { PasswordField } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
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
    <AuthFrame>
      <AuthHeading
        title={t.auth.updateTitle}
        description={t.auth.updateSubtitle}
        illustration={<AuthIllustration icon={LockIcon} />}
      />

      {params.error ? <Feedback result={{ ok: false, error: params.error }} className="mt-5" /> : null}

      <form action={updatePasswordAction} className="mt-6 space-y-4">
        <PasswordField
          required
          label={t.auth.newPasswordLabel}
          name="password"
          autoComplete="new-password"
          minLength={8}
          hint={t.auth.passwordHint}
          placeholder={t.auth.passwordPlaceholder}
        />
        <SubmitButton size="lg" className="w-full" pendingLabel={t.common.sending}>
          {t.auth.updateCta}
        </SubmitButton>
      </form>
    </AuthFrame>
  );
}
