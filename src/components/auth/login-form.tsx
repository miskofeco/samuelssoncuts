"use client";

import { useActionState } from "react";

import { resendConfirmationAction, signInAction } from "@/app/actions";
import { AuthLink } from "@/components/auth/auth-panel";
import { Feedback } from "@/components/shared/feedback";
import { Field, PasswordField } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { EMPTY_AUTH_FORM_STATE } from "@/domain/auth-form";
import { useT } from "@/i18n/provider";

/**
 * Email + password sign-in. The server action returns field-level errors
 * instead of redirecting, so the typed email survives a failed attempt and the
 * message points at the right input. When the only problem is an unconfirmed
 * email, a "resend confirmation" action appears under the banner.
 */
export function LoginForm({
  initialEmail,
  unconfirmedEmail,
}: {
  initialEmail?: string;
  /** Email that just received (or needs) a confirmation link; shows the resend button. */
  unconfirmedEmail?: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(signInAction, EMPTY_AUTH_FORM_STATE);
  const email = state.values?.email ?? initialEmail ?? "";
  const resendFor = state.unconfirmedEmail ?? unconfirmedEmail;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" noValidate>
        <Field
          required
          label={t.common.email}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          error={state.fieldErrors?.email}
          placeholder={t.auth.emailPlaceholder}
        />
        <PasswordField
          required
          label={t.auth.passwordLabel}
          name="password"
          autoComplete="current-password"
          minLength={8}
          hint={t.auth.passwordHint}
          error={state.fieldErrors?.password}
          placeholder={t.auth.passwordPlaceholder}
        />
        <Feedback result={state.error ? { ok: false, error: state.error } : null} />
        <SubmitButton size="lg" className="w-full" pendingLabel={t.common.sending}>
          {t.auth.signIn}
        </SubmitButton>
        <p className="flex justify-center text-sm">
          <AuthLink href="/reset-password" muted>
            {t.auth.forgotPassword}
          </AuthLink>
        </p>
      </form>

      {resendFor && !pending ? (
        <form action={resendConfirmationAction} className="rounded-xl bg-muted/60 p-3 text-sm">
          <input type="hidden" name="email" value={resendFor} />
          <p className="text-muted-foreground">{t.auth.checkInboxHint}</p>
          <SubmitButton variant="outline" size="default" className="mt-2 w-full" pendingLabel={t.common.sending}>
            {t.auth.resendConfirmation}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
