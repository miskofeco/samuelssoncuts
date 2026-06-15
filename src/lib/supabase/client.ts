import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "@/lib/env";

export function createClient() {
  const env = requireSupabaseEnv();

  return createBrowserClient<Database>(env.url, env.publishableKey);
}
