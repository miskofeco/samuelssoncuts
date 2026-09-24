// Supabase Auth errors carry a stable `code` (and an HTTP status); the message
// text is English and not meant for people. Every auth action classifies the
// error into what the person can act on, and only "unknown" is reported as a
// fault. Database failures ("Database error saving new user") stay "unknown"
// on purpose: they are bugs to fix, not something the visitor can correct.

export type AuthErrorKind =
  | "email_taken"
  | "email_invalid"
  | "weak_password"
  | "rate_limited"
  | "signup_disabled"
  | "email_delivery"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "same_password"
  | "banned"
  | "unknown";

type AuthErrorLike = { code?: string | null; status?: number | null; message?: string | null } | null | undefined;

const KIND_BY_CODE: Record<string, AuthErrorKind> = {
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  identity_already_exists: "email_taken",
  email_address_invalid: "email_invalid",
  weak_password: "weak_password",
  over_email_send_rate_limit: "rate_limited",
  over_request_rate_limit: "rate_limited",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "signup_disabled",
  provider_disabled: "signup_disabled",
  // The branded auth emails go through the Send Email Hook; a slow or failing
  // hook aborts the sign-up and nothing is saved, so a retry is safe.
  hook_timeout: "email_delivery",
  hook_timeout_after_retry: "email_delivery",
  email_address_not_authorized: "email_delivery",
  invalid_credentials: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  same_password: "same_password",
  user_banned: "banned",
};

export function authErrorKind(error: AuthErrorLike): AuthErrorKind {
  if (!error) return "unknown";
  const byCode = error.code ? KIND_BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  const message = error.message?.toLowerCase() ?? "";
  if (error.status === 429) return "rate_limited";
  if (message.includes("sending") && message.includes("email")) return "email_delivery";
  if (error.code === "validation_failed" && message.includes("email")) return "email_invalid";
  return "unknown";
}
