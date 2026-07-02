import { type NextRequest, NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

// OAuth / email-confirmation redirect target. Handles the provider error case
// and a failed code exchange by bouncing back to /login with a generic message,
// rather than silently landing an unauthenticated user on /dashboard.
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const providerError =
    requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");

  const loginWithError = () =>
    NextResponse.redirect(
      `${getSiteUrl()}/login?error=${encodeURIComponent("Sign-in could not be completed. Please try again.")}`,
    );

  if (providerError) {
    await reportError("auth-callback", new Error(providerError));
    return loginWithError();
  }

  if (!code) {
    return loginWithError();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await reportError("auth-callback", error);
    return loginWithError();
  }

  // Password-recovery links exchange to a valid session too; send them to set a
  // new password instead of into the app.
  if (requestUrl.searchParams.get("type") === "recovery") {
    return NextResponse.redirect(`${getSiteUrl()}/auth/update-password`);
  }

  return NextResponse.redirect(`${getSiteUrl()}/dashboard`);
}
