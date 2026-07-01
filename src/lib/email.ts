// Central email delivery helper using Resend.
//
// When RESEND_API_KEY is not set (local dev without credentials), the send is
// skipped and the notification row still gets written to the DB — so the app
// never crashes and /client/notifications stays accurate.

import { Resend } from "resend";
import { getBarberEmail, getEmailFrom, getResendApiKey } from "@/lib/env";
import type { ReactElement } from "react";

export type EmailPayload = {
  to: string | string[];
  subject: string;
  react: ReactElement;
};

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const key = getResendApiKey();
  if (!key || key.startsWith("re_PASTE")) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const resend = getResend();
  if (!resend) {
    // Dev fallback: log subject so you can see what would have been sent.
    console.info("[email] (no API key) →", payload.subject, "→", payload.to);
    return;
  }
  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    replyTo: getBarberEmail(),
    to: payload.to,
    subject: payload.subject,
    react: payload.react,
  });
  if (error) {
    // Non-fatal: the notification row already exists for audit; log and move on.
    console.error("[email] Resend error:", error.message ?? JSON.stringify(error));
  }
}

// Convenience re-export so callers don't need a separate import.
export { getBarberEmail };
