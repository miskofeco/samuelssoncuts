export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return env;
}

export function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function requireSupabaseServiceRoleKey(): string {
  const key = getSupabaseServiceRoleKey();

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return key;
}

// Canonical public production origin. Used only as the last-resort host for
// email images, which mail clients fetch without any session or env context.
export const PRODUCTION_SITE_ORIGIN = "https://www.samuelssoncuts.sk";

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Invalid public site URL: expected http or https");
    }

    if (process.env.NODE_ENV !== "production" || url.protocol === "https:") {
      return url.origin;
    }
  }

  // VERCEL_URL can be a protected preview deployment. Email and auth links
  // need the stable public production domain when an HTTP dev value leaks in.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    throw new Error("Missing public site URL: configure NEXT_PUBLIC_SITE_URL or expose VERCEL_PROJECT_PRODUCTION_URL");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return configured ? new URL(configured).origin : "http://localhost:3000";
}

/**
 * Origin that hosts remote email images (logo, icons in `public/`).
 *
 * Mail clients and Gmail's image proxy fetch these URLs from the recipient's
 * side, so they must be absolute, HTTPS and publicly reachable. Resolution:
 * 1. `EMAIL_ASSET_ORIGIN` when set (HTTPS in production; HTTP allowed locally
 *    so `/email-preview` can point at a dev server with new assets).
 * 2. The public site URL when it is HTTPS.
 * 3. The canonical production origin, so emails sent from local development
 *    or an HTTP-configured environment never embed localhost image URLs.
 */
export function getEmailAssetOrigin(): string {
  const configured = process.env.EMAIL_ASSET_ORIGIN?.trim();
  if (configured) {
    const url = new URL(configured);
    const httpsOnly = process.env.NODE_ENV === "production";
    if (url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:")) {
      throw new Error("Invalid EMAIL_ASSET_ORIGIN: expected a public https origin");
    }
    return url.origin;
  }

  const siteUrl = getSiteUrl();
  if (siteUrl.startsWith("https://")) {
    return siteUrl;
  }

  return PRODUCTION_SITE_ORIGIN;
}

export function getShopTimeZone() {
  return process.env.NEXT_PUBLIC_SHOP_TIME_ZONE ?? "Europe/Bratislava";
}

// ─── Legal contact defaults ───────────────────────────────────────────────────
// The booking location and phone are barber-managed in booking_contact_settings.
// These values remain the legal-page defaults supplied for the shop.

export function getShopAddress(): string | null {
  return process.env.NEXT_PUBLIC_SHOP_ADDRESS || "Skrabske 107, 094 33";
}

export function getShopPhone(): string | null {
  return process.env.NEXT_PUBLIC_SHOP_PHONE || "+421918531257";
}

export function getErrorReportWebhookUrl(): string | null {
  return process.env.ERROR_REPORT_WEBHOOK_URL ?? null;
}

// ─── Web Push ────────────────────────────────────────────────────────────────

export type WebPushEnv = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getWebPushPublicKey(): string | null {
  return process.env.WEB_PUSH_PUBLIC_KEY ?? null;
}

export function getWebPushPrivateKey(): string | null {
  return process.env.WEB_PUSH_PRIVATE_KEY ?? null;
}

export function getWebPushSubject(): string | null {
  return process.env.WEB_PUSH_SUBJECT ?? null;
}

export function getWebPushEnv(): WebPushEnv | null {
  const publicKey = getWebPushPublicKey();
  const privateKey = getWebPushPrivateKey();
  const subject = getWebPushSubject();

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

// ─── Email ────────────────────────────────────────────────────────────────────

export function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

export function getEmailFrom(): string {
  return process.env.RESEND_FROM_ADDRESS ?? "Samuelsson Cuts <noreply@samuelssoncuts.com>";
}

// Secret for the Supabase "Send Email Hook" (Standard Webhooks). Value looks
// like "v1,whsec_<base64>"; Supabase generates it when you enable the hook.
export function getSendEmailHookSecret(): string | null {
  return process.env.SEND_EMAIL_HOOK_SECRET ?? null;
}

// ─── Cron ─────────────────────────────────────────────────────────────────────

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}
