// Supabase "Send Email Hook" endpoint. When enabled in the Supabase dashboard,
// Supabase POSTs here instead of sending its own built-in auth emails, so we can
// render them with our branded EmailLayout and deliver via Resend from the
// barber's domain.
//
// Security: requests are signed with the Standard Webhooks scheme. We verify the
// HMAC-SHA256 signature over `${id}.${timestamp}.${rawBody}` using the hook
// secret before trusting anything. An unsigned/invalid request is rejected 401.
//
// Payload shape (Supabase):
//   { user: { email, ... },
//     email_data: { token_hash, email_action_type, redirect_to, site_url, ... } }
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { AuthEmail } from "@/emails/auth-email";
import { sendEmail } from "@/lib/email";
import { getSendEmailHookSecret, getSiteUrl } from "@/lib/env";
import { logEvent, reportError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verify a Standard Webhooks signature. `secret` is "v1,whsec_<base64>" (or bare
// "whsec_<base64>"); the signed content is `${id}.${timestamp}.${body}` and the
// header carries one or more space-separated `v1,<base64sig>` entries.
function verifySignature(
  secret: string,
  headers: Headers,
  body: string,
): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject stale timestamps (±5 min) to blunt replay attacks.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const base64Secret = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  let key: Buffer;
  try {
    key = Buffer.from(base64Secret, "base64");
  } catch {
    return false;
  }

  const signed = `${id}.${timestamp}.${body}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");
  const expectedBuf = Buffer.from(expected);

  // The header may list several signatures ("v1,sigA v1,sigB"); accept any match.
  for (const part of signatureHeader.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

type HookPayload = {
  user?: { email?: string };
  email_data?: {
    token_hash?: string;
    email_action_type?: string;
    redirect_to?: string;
  };
};

export async function POST(request: NextRequest) {
  const secret = getSendEmailHookSecret();
  if (!secret) {
    console.error("[auth/send-email] SEND_EMAIL_HOOK_SECRET is not configured");
    return NextResponse.json({ error: "Hook secret not configured" }, { status: 503 });
  }

  const raw = await request.text();
  if (!verifySignature(secret, request.headers, raw)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(raw) as HookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const email = payload.user?.email;
  const tokenHash = payload.email_data?.token_hash;
  const actionType = payload.email_data?.email_action_type ?? "email";
  const redirectTo = payload.email_data?.redirect_to;

  if (!email || !tokenHash) {
    return NextResponse.json({ error: "Missing email or token" }, { status: 400 });
  }

  // Build the verification link to our own /auth/confirm handler (token-hash
  // flow → verifyOtp). Preserve Supabase's redirect_to when present.
  const site = getSiteUrl();
  const confirmUrl = new URL(`${site}/auth/confirm`);
  confirmUrl.searchParams.set("token_hash", tokenHash);
  confirmUrl.searchParams.set("type", actionType);
  if (redirectTo) confirmUrl.searchParams.set("redirect_to", redirectTo);

  const subjectByType: Record<string, string> = {
    signup: "Confirm your email — Samuelsson Cuts",
    recovery: "Reset your password — Samuelsson Cuts",
    magiclink: "Your sign-in link — Samuelsson Cuts",
    email_change: "Confirm your new email — Samuelsson Cuts",
    email: "Verify your email — Samuelsson Cuts",
  };

  try {
    await sendEmail({
      to: email,
      subject: subjectByType[actionType] ?? subjectByType.email,
      react: AuthEmail({ kind: actionType, confirmUrl: confirmUrl.toString() }),
    });
  } catch (error) {
    // If sending fails, return 500 so Supabase surfaces the failure to the user
    // (an auth email that silently vanishes is worse than a visible error).
    await reportError("auth-send-email", error, { actionType });
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  logEvent("auth-send-email", { actionType });
  // Supabase expects a 200 with an empty/success body to consider the hook handled.
  return NextResponse.json({});
}
