import type { MetadataRoute } from "next";

// Web app manifest — makes the app installable ("add to home screen") on mobile
// and desktop. No service worker / offline support; this is purely
// installability + branding. Colors match the light app surface.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Samuelsson Cuts",
    short_name: "Samuelsson",
    description: "Book and manage your barbershop appointments at Samuelsson Cuts.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#0c0a09",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Same asset flagged maskable so Android can crop it to the platform shape.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
