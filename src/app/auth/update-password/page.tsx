import { LockIcon } from "@hugeicons/core-free-icons";
import { redirect } from "next/navigation";

import { updatePasswordAction } from "@/app/actions";
import { AuthFrame, AuthHeading, AuthIllustration } from "@/components/auth/auth-panel";
import { Feedback } from "@/components/shared/feedback";
import { PasswordField } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { authErrorPath, resolveAuthError } from "@/i18n/auth-notices";
import { getDict } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const t = await getDict();

  // Only reachable with the session the recovery link established. Without one
  // the link expired or was already used; submitting would fail anyway.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect(authErrorPath("/reset-password", "reset_link_invalid"));
  }

  const error = resolveAuthError(t, params.error);

  return (
    <AuthFrame>
      <AuthHeading
        title={t.auth.updateTitle}
        description={t.auth.updateSubtitle}
        illustration={<AuthIllustration icon={LockIcon} />}
      />

      {error ? <Feedback result={{ ok: false, error }} className="mt-5" /> : null}

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
