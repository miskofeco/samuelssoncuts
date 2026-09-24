// Where a Google (OAuth) round trip lands. The same provider flow both signs in
// and registers: Supabase creates the auth user on the first consent and the
// handle_new_user trigger seeds a pending, phone-less profile. The intent the
// person started from (login or register page) only changes what they are told.

export type OAuthIntent = "login" | "register";

export const OAUTH_INTENT_COOKIE = "oauth_intent";

export function parseOAuthIntent(value: string | null | undefined): OAuthIntent {
  return value === "register" ? "register" : "login";
}

/** The auth page an OAuth failure returns to: the one the person came from. */
export function oauthStartPath(intent: OAuthIntent) {
  return intent === "register" ? "/register" : "/login";
}

export type OAuthProviderFailure = "cancelled" | "not_registered" | "failed";

// Supabase forwards provider and sign-up failures as error/error_code/
// error_description query parameters. "access_denied" alone is the person
// closing Google's consent screen, but Supabase also reports disabled sign-ups
// with access_denied, so the error code is checked first.
export function classifyOAuthProviderError(params: {
  error: string | null;
  errorCode: string | null;
  description: string | null;
}): OAuthProviderFailure {
  const description = params.description?.toLowerCase() ?? "";
  if (params.errorCode === "signup_disabled" || description.includes("signups not allowed")) {
    return "not_registered";
  }
  if (params.error === "access_denied" && !params.errorCode) return "cancelled";
  return "failed";
}

// Supabase sets created_at and last_sign_in_at together when the first consent
// creates the user; a returning account signed in long after it was created.
const NEW_ACCOUNT_WINDOW_MS = 2 * 60_000;

export function isNewOAuthAccount(user: { created_at?: string | null; last_sign_in_at?: string | null } | null | undefined) {
  const created = Date.parse(user?.created_at ?? "");
  const signedIn = Date.parse(user?.last_sign_in_at ?? "");
  if (!Number.isFinite(created)) return false;
  return !Number.isFinite(signedIn) || Math.abs(signedIn - created) <= NEW_ACCOUNT_WINDOW_MS;
}

export type OAuthLandingNotice = "google_registered" | "registration_incomplete";

/**
 * After a successful code exchange. An account without a phone has not
 * finished registering: it goes to /complete-profile, and someone who pressed
 * Google on the login page learns that this started (or resumes) a
 * registration instead of wondering why they are not signed in.
 */
export function oauthLandingPath(input: {
  intent: OAuthIntent;
  needsPhone: boolean;
  isNewAccount: boolean;
}): string {
  if (!input.needsPhone) return "/dashboard";
  const notice: OAuthLandingNotice | null = input.intent === "register"
    ? null
    : input.isNewAccount
      ? "google_registered"
      : "registration_incomplete";
  return notice ? `/complete-profile?notice=${notice}` : "/complete-profile";
}
