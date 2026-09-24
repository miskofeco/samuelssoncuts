"use client";

import { useActionState } from "react";
import Link from "next/link";

import { registerAction } from "@/app/actions";
import { Feedback } from "@/components/shared/feedback";
import { Field, PasswordField } from "@/components/shared/form";
import { SubmitButton } from "@/components/shared/submit-button";
import { EMPTY_AUTH_FORM_STATE } from "@/domain/auth-form";
import { useT } from "@/i18n/provider";

/**
 * Password registration. Every field is validated server-side and the action
 * reports all problems at once next to the inputs; the entered values (never
 * the password) are echoed back so nothing has to be retyped.
 */
export function RegisterForm({ initialEmail }: { initialEmail?: string }) {
  const t = useT();
  const [state, formAction] = useActionState(registerAction, EMPTY_AUTH_FORM_STATE);
  const values = state.values;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        required
        label={t.common.fullName}
        name="fullName"
        autoComplete="name"
        defaultValue={values?.fullName ?? ""}
        error={state.fieldErrors?.fullName}
        placeholder={t.auth.namePlaceholder}
      />
      <Field
        required
        label={t.common.email}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={values?.email ?? initialEmail ?? ""}
        error={state.fieldErrors?.email}
        placeholder={t.auth.emailPlaceholder}
      />
      <Field
        required
        label={t.common.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        defaultValue={values?.phone ?? ""}
        error={state.fieldErrors?.phone}
        placeholder={t.auth.phonePlaceholder}
      />
      <PasswordField
        required
        label={t.auth.passwordLabel}
        name="password"
        autoComplete="new-password"
        minLength={8}
        hint={t.auth.passwordHint}
        error={state.fieldErrors?.password}
        placeholder={t.auth.passwordPlaceholder}
      />
      <Feedback result={state.error ? { ok: false, error: state.error } : null} />
      <SubmitButton size="lg" className="w-full" pendingLabel={t.common.sending}>
        {t.auth.createAccount}
      </SubmitButton>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        <Link className="underline underline-offset-4 hover:text-foreground" href="/terms">
          {t.consent.banner.termsLink}
        </Link>
        {" · "}
        <Link className="underline underline-offset-4 hover:text-foreground" href="/privacy">
          {t.consent.banner.privacyLink}
        </Link>
      </p>
    </form>
  );
}
