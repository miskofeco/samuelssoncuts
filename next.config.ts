import type { NextConfig } from "next";

// Allow next/image to optimise images from the public Supabase Storage
// buckets (avatars, service photos). Hostname is derived from
// NEXT_PUBLIC_SUPABASE_URL so it follows the project.
function supabaseImagePattern() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { hostname } = new URL(url);
    return ["avatars", "service-images"].map((bucket) => ({
      protocol: "https" as const,
      hostname,
      pathname: `/storage/v1/object/public/${bucket}/**`,
    }));
  } catch {
    return [];
  }
}

// Baseline security headers applied to every response. The nonce-based CSP is
// emitted per request by src/proxy.ts; these static headers cover clickjacking,
// MIME sniffing, referrer leakage, feature policy and protocol downgrade.
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
  experimental: {
    // Avatar and service images are capped at 3 MiB in their server actions.
    // Multipart boundaries and form fields need some room above the file cap.
    serverActions: { bodySizeLimit: "3200kb" },
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
