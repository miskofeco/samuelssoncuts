import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { authErrorPath } from "@/i18n/auth-notices";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

// Verification target for auth emails sent via our Send Email Hook. Those emails
// carry a `token_hash` + `type` (not an OAuth `code`), so this uses verifyOtp —
// distinct from /auth/callback, which handles the OAuth/PKCE code exchange.
//
// On success: recovery → /auth/update-password (set new password); everything
// else → /dashboard. On failure → the relevant auth page with an error code.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const type = OTP_TYPES.find((candidate) => candidate === typeParam) ?? null;
  const site = getSiteUrl();

  const fail = () =>
    NextResponse.redirect(
      `${site}${
        typeParam === "recovery"
          ? authErrorPath("/reset-password", "reset_link_invalid")
          : authErrorPath("/login", "link_invalid")
      }`,
    );

  if (!tokenHash || !type) {
    return fail();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    await reportError("auth-confirm", error, { type, code: error.code });
    return fail();
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${site}/auth/update-password`);
  }

  return NextResponse.redirect(`${site}/dashboard`);
}
