import type { NextConfig } from "next";

// Allow next/image to load avatars from the public Supabase Storage bucket.
// Hostname is derived from NEXT_PUBLIC_SUPABASE_URL so it follows the project.
function supabaseImagePattern() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { hostname } = new URL(url);
    return [
      {
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/avatars/**",
      },
    ];
  } catch {
    return [];
  }
}

// Baseline security headers applied to every response. Kept framework-level
// (not a nonce-based CSP) so it can't break Next's inline bootstrap/theme
// scripts; frame-ancestors + nosniff + HSTS cover the highest-impact risks
// (clickjacking, MIME sniffing, protocol downgrade).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Use Vercel's per-deployment identifier so stale clients reload onto the
  // new asset graph instead of requesting deleted chunk hashes after deploys.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.NEXT_DEPLOYMENT_ID,
  images: {
    remotePatterns: supabaseImagePattern(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
