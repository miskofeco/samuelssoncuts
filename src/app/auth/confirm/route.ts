import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";

// Verification target for auth emails sent via our Send Email Hook. Those emails
// carry a `token_hash` + `type` (not an OAuth `code`), so this uses verifyOtp —
// distinct from /auth/callback, which handles the OAuth/PKCE code exchange.
//
// On success: recovery → /auth/update-password (set new password); everything
// else → /dashboard. On failure → /login with a generic message.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const site = getSiteUrl();

  const loginWithError = () =>
    NextResponse.redirect(
      `${site}/login?error=${encodeURIComponent("This link is invalid or has expired. Please try again.")}`,
    );

  if (!tokenHash || !type) {
    return loginWithError();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    await reportError("auth-confirm", error, { type });
    return loginWithError();
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${site}/auth/update-password`);
  }

  return NextResponse.redirect(`${site}/dashboard`);
}
