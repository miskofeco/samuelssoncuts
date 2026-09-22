// Central email delivery helper using Resend.
//
// When RESEND_API_KEY is not set (local dev without credentials), the send is
// skipped and the notification row still gets written to the DB — so the app
// never crashes and /client/notifications stays accurate.
//
// Delivery is best-effort: callers invoke sendEmail() after the database write
// has already committed, so a Resend outage or network error must never turn a
// persisted action into a failure. Errors are reported and `false` is returned.

import "server-only";

import { Resend } from "resend";
import { getEmailFrom, getResendApiKey } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { getShopBarberEmail } from "@/server/shop-barber";
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
    // Dev fallback: note that a send was skipped without logging the recipient
    // or the (name-bearing) subject — logs must stay free of personal data.
    if (process.env.NODE_ENV !== "production") {
      console.info("[email] (no API key) skipped", { recipients: Array.isArray(payload.to) ? payload.to.length : 1 });
    }
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      replyTo: await getShopBarberEmail(),
      to: payload.to,
      subject: payload.subject,
      react: payload.react,
    });
    if (error) {
      await reportError("email-send", error);
      return false;
    }
    return true;
  } catch (error) {
    await reportError("email-send", error);
    return false;
  }
}
