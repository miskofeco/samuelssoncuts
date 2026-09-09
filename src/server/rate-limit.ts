import { headers } from "next/headers";

import { getSupabaseServiceRoleKey } from "@/lib/env";
import { reportError } from "@/lib/observability";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/i18n/server";

type RateLimitOptions = {
  identity?: string | null;
  limit: number;
  windowSeconds: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:._@-]/g, "_").slice(0, 160);
}

async function requestIp() {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"
  );
}

// check_rate_limit is executable by the service role only (migration 0026), so
// a caller can never burn another identity's budget through PostgREST. The
// user-session client is kept as a fallback for environments without a
// service-role key; there the RPC fails closed once 0026 is applied.
async function rateLimitClient() {
  if (getSupabaseServiceRoleKey()) {
    return getSupabaseAdminClient();
  }
  return createClient();
}

export async function enforceRateLimit(
  scope: string,
  options: RateLimitOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const identity = options.identity || await requestIp();
  const key = `${normalize(scope)}:${normalize(identity)}`;

  const supabase = await rateLimitClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    await reportError("rate-limit", error, { scope });
  }

  if (error || data !== true) {
    const t = await getDict();
    return { ok: false, error: t.feedback.tooManyAttempts };
  }

  return { ok: true };
}
