import { type NextRequest, NextResponse } from "next/server";

import {
  classifyOAuthProviderError,
  isNewOAuthAccount,
  OAUTH_INTENT_COOKIE,
  oauthLandingPath,
  oauthStartPath,
  parseOAuthIntent,
} from "@/domain/oauth-landing";
import { getSiteUrl } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { type AuthErrorCode, authErrorPath } from "@/i18n/auth-notices";
import { needsPhone } from "@/server/auth";

// OAuth / PKCE redirect target. Errors bounce back to the auth page the person
// started from with a short code (localised there), never with free text in
// the URL, and never silently land an unauthenticated user on /dashboard.
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const site = getSiteUrl();
  const code = requestUrl.searchParams.get("code");
  const isRecovery = requestUrl.searchParams.get("type") === "recovery";
  const providerError = requestUrl.searchParams.get("error");
  const providerErrorCode = requestUrl.searchParams.get("error_code");
  const providerErrorDescription = requestUrl.searchParams.get("error_description");
  const intent = parseOAuthIntent(request.cookies.get(OAUTH_INTENT_COOKIE)?.value);

  // The intent cookie is single-use: every outcome clears it.
  const go = (path: string) => {
    const response = NextResponse.redirect(`${site}${path}`);
    response.cookies.set(OAUTH_INTENT_COOKIE, "", { path: "/auth", maxAge: 0 });
    return response;
  };
  const fail = (reason: AuthErrorCode) =>
    go(isRecovery ? authErrorPath("/reset-password", "reset_link_invalid") : authErrorPath(oauthStartPath(intent), reason));

  if (providerError || providerErrorDescription) {
    const failure = classifyOAuthProviderError({
      error: providerError,
      errorCode: providerErrorCode,
      description: providerErrorDescription,
    });
    // The person closed or declined the Google consent screen: not a fault.
    if (failure === "cancelled") {
      return fail("oauth_cancelled");
    }
    // Sign-ups are closed in Supabase, so an unknown Google account cannot be
    // created on the fly: tell the person to register first.
    if (failure === "not_registered") {
      return go(authErrorPath("/register", "oauth_not_registered"));
    }
    await reportError("auth-callback", new Error(providerErrorDescription ?? providerError ?? "unknown"), {
      code: providerErrorCode ?? providerError,
    });
    return fail("oauth_failed");
  }

  if (!code) {
    return fail("link_invalid");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await reportError("auth-callback", error, { code: error.code });
    return fail("link_invalid");
  }

  // Password-recovery links exchange to a valid session too; send them to set a
  // new password instead of into the app.
  if (isRecovery) {
    return go("/auth/update-password");
  }

  // A Google account seen for the first time was just registered by Supabase
  // (pending, no phone). Route it straight into finishing the registration.
  // Without a readable profile /dashboard applies the usual profile_missing path.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, phone")
    .eq("id", data.user.id)
    .maybeSingle();

  return go(oauthLandingPath({
    intent,
    needsPhone: profile ? needsPhone(profile) : false,
    isNewAccount: isNewOAuthAccount(data.user),
  }));
}
