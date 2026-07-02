import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/env";

// updateSession refreshes the Supabase auth session on every request and, when
// provided, threads a per-request CSP nonce through both the forwarded request
// headers (so Next's SSR applies it to framework/inline scripts) and the
// response headers (so the browser enforces it).
export async function updateSession(
  request: NextRequest,
  security?: { nonce: string; csp: string },
) {
  const env = getSupabaseEnv();

  // Forward incoming request headers, adding the nonce + CSP so downstream
  // rendering can read them (Next extracts the nonce from the CSP header).
  const requestHeaders = new Headers(request.headers);
  if (security) {
    requestHeaders.set("x-nonce", security.nonce);
    requestHeaders.set("Content-Security-Policy", security.csp);
  }

  const applyCsp = (response: NextResponse) => {
    if (security) response.headers.set("Content-Security-Policy", security.csp);
    return response;
  };

  if (!env) {
    return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  return applyCsp(response);
}
