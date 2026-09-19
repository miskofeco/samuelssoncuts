import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "@/lib/env";

// One session-bound client per request: layouts, pages and nested loaders all
// call this, and each call used to await cookies() and build a fresh client.
export const createClient = cache(async () => {
  const env = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. The proxy handles refreshes.
        }
      },
    },
  });
});
