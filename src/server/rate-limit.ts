import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

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

export async function enforceRateLimit(
  scope: string,
  options: RateLimitOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const identity = options.identity || await requestIp();
  const key = `${normalize(scope)}:${normalize(identity)}`;

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (error || data !== true) {
    return { ok: false, error: "Too many attempts. Try again later." };
  }

  return { ok: true };
}
