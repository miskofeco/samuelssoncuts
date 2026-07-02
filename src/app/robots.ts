import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";

// Public marketing page is indexable; authenticated app areas are not.
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/client", "/api", "/dashboard", "/pending", "/complete-profile", "/setup"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
