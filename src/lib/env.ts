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

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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

// ─── Cron ─────────────────────────────────────────────────────────────────────

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}
