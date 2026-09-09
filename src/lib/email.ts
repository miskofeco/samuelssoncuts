// Central email delivery helper using Resend.
//
// When RESEND_API_KEY is not set (local dev without credentials), the send is
// skipped and the notification row still gets written to the DB — so the app
// never crashes and /client/notifications stays accurate.
//
// Delivery is best-effort: callers invoke sendEmail() after the database write
// has already committed, so a Resend outage or network error must never turn a
// persisted action into a failure. Errors are reported and `false` is returned.

import { Resend } from "resend";
import { getBarberEmail, getEmailFrom, getResendApiKey } from "@/lib/env";
import { reportError } from "@/lib/observability";
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

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    // Dev fallback: log subject so you can see what would have been sent.
    console.info("[email] (no API key) →", payload.subject, "→", payload.to);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      replyTo: getBarberEmail(),
      to: payload.to,
      subject: payload.subject,
      react: payload.react,
    });
    if (error) {
      await reportError("email-send", error, { subject: payload.subject });
      return false;
    }
    return true;
  } catch (error) {
    await reportError("email-send", error, { subject: payload.subject });
    return false;
  }
}

// Convenience re-export so callers don't need a separate import.
export { getBarberEmail };
