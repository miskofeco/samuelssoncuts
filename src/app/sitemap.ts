import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";

// Only the public entry points are listed; the app itself is auth-gated.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/login`, priority: 0.5 },
    { url: `${base}/register`, priority: 0.5 },
    { url: `${base}/cookies`, priority: 0.3 },
    { url: `${base}/privacy`, priority: 0.3 },
    { url: `${base}/terms`, priority: 0.3 },
  ];
}
