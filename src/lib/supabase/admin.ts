import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv, requireSupabaseServiceRoleKey } from "@/lib/env";

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

let adminClient: SupabaseAdminClient | null = null;

export function getSupabaseAdminClient(): SupabaseAdminClient {
  if (adminClient) return adminClient;

  const env = requireSupabaseEnv();
  adminClient = createClient<Database>(env.url, requireSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
