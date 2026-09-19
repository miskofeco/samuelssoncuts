// State returned by the sign-in / registration server actions to their
// `useActionState` forms. Passwords are never echoed back; other values are so
// the form can repopulate after React resets it post-submit.
export type AuthField = "fullName" | "email" | "phone" | "password";

export type AuthFormState = {
  /** Form-level error banner. */
  error?: string;
  /** Per-field validation messages, rendered under the matching input. */
  fieldErrors?: Partial<Record<AuthField, string>>;
  /** Set when sign-in failed only because the email is unverified; enables "resend". */
  unconfirmedEmail?: string;
  values?: { fullName?: string; email?: string; phone?: string };
};

export const EMPTY_AUTH_FORM_STATE: AuthFormState = {};
