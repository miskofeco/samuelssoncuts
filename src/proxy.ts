import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Build a per-request Content-Security-Policy. Scripts use a nonce +
// 'strict-dynamic' (the real XSS defense); styles allow 'unsafe-inline' because
// React/Recharts emit inline style attributes and there is no script-injection
// risk from styles. The Supabase origin is allowed for REST, realtime
// websockets (wss), and public Storage images.
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseHost = "";
  let supabaseWs = "";
  if (supabaseUrl) {
    try {
      const { host } = new URL(supabaseUrl);
      supabaseHost = `https://${host}`;
      supabaseWs = `wss://${host}`;
    } catch {
      // ignore malformed URL — CSP just omits the Supabase origin
    }
  }

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${supabaseHost}`.trim(),
    `font-src 'self'`,
    `connect-src 'self' ${supabaseHost} ${supabaseWs}`.trim(),
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  return updateSession(request, { nonce, csp });
}

export const config = {
  matcher: [
    // Run on all pages except static assets and images (which don't need a
    // nonce and shouldn't pay for dynamic rendering). Skip prefetches too.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
