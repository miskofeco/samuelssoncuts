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

export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getShopTimeZone() {
  return process.env.NEXT_PUBLIC_SHOP_TIME_ZONE ?? "Europe/Bratislava";
}

// ─── Shop contact (shown on the appointment detail view) ───────────────────────
// Public so both server and client components can read them.

export function getShopAddress(): string | null {
  return process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? null;
}

export function getShopPhone(): string | null {
  return process.env.NEXT_PUBLIC_SHOP_PHONE ?? null;
}

/** Google Maps search link for the configured address (null when unset). */
export function getShopMapUrl(): string | null {
  const address = getShopAddress();
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
}

export function getErrorReportWebhookUrl(): string | null {
  return process.env.ERROR_REPORT_WEBHOOK_URL ?? null;
}

// ─── Email ────────────────────────────────────────────────────────────────────

export function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

export function getEmailFrom(): string {
  return process.env.RESEND_FROM_ADDRESS ?? "Samuelsson Cuts <noreply@samuelssoncuts.com>";
}

export function getBarberEmail(): string {
  return process.env.BARBER_EMAIL ?? "barber@samuelssoncuts.com";
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
