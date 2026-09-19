import type { Dict } from "./dictionaries";

// Auth pages receive their banner state through the URL (redirects from route
// handlers and server actions). Only short codes travel in the query string:
// a link cannot inject arbitrary text into the page, and the message is
// rendered in the visitor's language instead of whatever language the redirect
// was produced in. Unknown codes render nothing.

export const AUTH_ERROR_CODES = [
  "oauth_failed",
  "oauth_cancelled",
  "link_invalid",
  "reset_link_invalid",
  "session_expired",
  "same_password",
  "password_too_short",
  "too_many_attempts",
  "profile_missing",
  "generic",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const AUTH_NOTICE_CODES = ["confirm_sent", "confirm_resent", "password_updated", "reset_sent", "account_deleted"] as const;
export type AuthNoticeCode = (typeof AUTH_NOTICE_CODES)[number];

export function authErrorPath(path: string, code: AuthErrorCode) {
  return `${path}?error=${code}`;
}

export function authNoticePath(path: string, code: AuthNoticeCode, email?: string) {
  const params = new URLSearchParams({ notice: code });
  if (email) params.set("email", email);
  return `${path}?${params.toString()}`;
}

export function resolveAuthError(t: Dict, code: string | undefined): string | null {
  switch (code) {
    case "oauth_failed":
      return t.auth.errors.oauthFailed;
    case "oauth_cancelled":
      return t.auth.errors.oauthCancelled;
    case "link_invalid":
      return t.auth.errors.linkInvalid;
    case "reset_link_invalid":
      return t.auth.resetLinkInvalid;
    case "session_expired":
      return t.auth.errors.sessionExpired;
    case "same_password":
      return t.auth.errors.samePassword;
    case "password_too_short":
      return t.auth.errors.passwordTooShort;
    case "too_many_attempts":
      return t.feedback.tooManyAttempts;
    case "profile_missing":
      return t.auth.errors.profileMissing;
    case "generic":
      return t.common.somethingWentWrong;
    default:
      return null;
  }
}

export function resolveAuthNotice(
  t: Dict,
  code: string | undefined,
  email?: string,
): string | null {
  switch (code) {
    case "confirm_sent":
      return email ? t.auth.notices.confirmSent(email) : t.auth.notices.confirmResent;
    case "confirm_resent":
      return t.auth.notices.confirmResent;
    case "password_updated":
      return t.auth.updated;
    case "reset_sent":
      return t.auth.resetSent;
    case "account_deleted":
      return t.feedback.accountDeleted;
    default:
      return null;
  }
}

/** True when the login page should offer to resend the confirmation email. */
export function noticeOffersResend(code: string | undefined): boolean {
  return code === "confirm_sent" || code === "confirm_resent";
}
