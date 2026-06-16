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

const nextConfig: NextConfig = {
  // Use Vercel's per-deployment identifier so stale clients reload onto the
  // new asset graph instead of requesting deleted chunk hashes after deploys.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.NEXT_DEPLOYMENT_ID,
  images: {
    remotePatterns: supabaseImagePattern(),
  },
};

export default nextConfig;
