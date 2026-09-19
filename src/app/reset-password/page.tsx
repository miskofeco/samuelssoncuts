import { ArrowLeft01Icon, Key01Icon } from "@hugeicons/core-free-icons";

import { requestPasswordResetAction } from "@/app/actions";
import { AuthFrame, AuthHeading, AuthIllustration, AuthLink } from "@/components/auth/auth-panel";
import { Feedback } from "@/components/shared/feedback";
import { Field } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { SubmitButton } from "@/components/shared/submit-button";
import { resolveAuthError, resolveAuthNotice } from "@/i18n/auth-notices";
import { getDict } from "@/i18n/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; email?: string }>;
}) {
  const params = await searchParams;
  const t = await getDict();
  const error = resolveAuthError(t, params.error);
  const message = resolveAuthNotice(t, params.notice);

  return (
    <AuthFrame>
      <AuthHeading
        title={t.auth.resetTitle}
        description={t.auth.resetSubtitle}
        illustration={<AuthIllustration icon={Key01Icon} />}
      />

      {error ? <Feedback result={{ ok: false, error }} className="mt-5" /> : null}
      {message ? <Feedback result={{ ok: true, message }} className="mt-5" /> : null}

      <form action={requestPasswordResetAction} className="mt-6 space-y-4">
        <Field
          required
          label={t.common.email}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={params.email?.slice(0, 254)}
          placeholder={t.auth.emailPlaceholder}
        />
        <SubmitButton size="lg" className="w-full" pendingLabel={t.common.sending}>
          {t.auth.resetCta}
        </SubmitButton>
      </form>

      <p className="mt-5 flex justify-center text-sm">
        <AuthLink href="/login" muted className="gap-1.5">
          <Icon icon={ArrowLeft01Icon} />
          {t.auth.backToLogin}
        </AuthLink>
      </p>
    </AuthFrame>
  );
}
