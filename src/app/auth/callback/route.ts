import { type NextRequest, NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { type AuthErrorCode, authErrorPath } from "@/i18n/auth-notices";

// OAuth / PKCE redirect target. Errors bounce back to the relevant auth page
// with a short code (localised there), never with free text in the URL, and
// never silently land an unauthenticated user on /dashboard.
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const site = getSiteUrl();
  const code = requestUrl.searchParams.get("code");
  const isRecovery = requestUrl.searchParams.get("type") === "recovery";
  const providerError = requestUrl.searchParams.get("error");
  const providerErrorDescription = requestUrl.searchParams.get("error_description");

  const fail = (reason: AuthErrorCode) =>
    NextResponse.redirect(
      `${site}${isRecovery ? authErrorPath("/reset-password", "reset_link_invalid") : authErrorPath("/login", reason)}`,
    );

  if (providerError || providerErrorDescription) {
    // The person closed or declined the Google consent screen: not a fault.
    if (providerError === "access_denied") {
      return fail("oauth_cancelled");
    }
    await reportError("auth-callback", new Error(providerErrorDescription ?? providerError ?? "unknown"), {
      code: providerError,
    });
    return fail("oauth_failed");
  }

  if (!code) {
    return fail("link_invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await reportError("auth-callback", error, { code: error.code });
    return fail("link_invalid");
  }

  // Password-recovery links exchange to a valid session too; send them to set a
  // new password instead of into the app.
  if (isRecovery) {
    return NextResponse.redirect(`${site}/auth/update-password`);
  }

  return NextResponse.redirect(`${site}/dashboard`);
}
