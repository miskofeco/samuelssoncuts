import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { ConsentPreferences } from "@/components/consent/consent-preferences";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { ThemeScript } from "@/components/shared/theme-script";
import { LanguageProvider } from "@/i18n/provider";
import { getConsent } from "@/lib/consent/server";
import { getSiteUrl } from "@/lib/env";
import { getDict, getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDict();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: dict.metadata.title,
    description: dict.metadata.description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.png",
      apple: "/icon-192.png",
    },
    appleWebApp: {
      capable: true,
      title: "Samuelsson Cuts",
      statusBarStyle: "default",
    },
  };
}

// theme-color adapts to the light/dark app surface (Next 16 requires this in the
// dedicated viewport export, not in metadata).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  const consent = await getConsent();
  // Per-request CSP nonce set by the proxy; used by the inline theme script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className="h-full"
    >
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <LanguageProvider lang={lang}>
          <ConsentProvider initial={consent}>
            {children}
            <ConsentBanner />
            <ConsentPreferences />
          </ConsentProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
