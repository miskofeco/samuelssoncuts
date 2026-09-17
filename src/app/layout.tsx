import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { ConsentPreferences } from "@/components/consent/consent-preferences";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { ThemeScript } from "@/components/shared/theme-script";
import { Toaster } from "@/components/shared/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/provider";
import { getConsent } from "@/lib/consent/server";
import { getSiteUrl } from "@/lib/env";
import { getDict, getLang } from "@/i18n/server";
import { cn } from "@/lib/classnames";

// Self-hosted at build time by next/font; exposed as --font-geist and consumed
// by the --font-sans token in globals.css.
const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist" });

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDict();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: dict.metadata.title,
    description: dict.metadata.description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.png",
      apple: "/iphone_icon.png",
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
  // Let the layout extend under notches/home indicators so env(safe-area-inset-*)
  // padding in sheets, the top bar and the toaster takes effect in the PWA.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
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
      className={cn("h-full", geist.variable)}
    >
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="flex min-h-full flex-col">
        <LanguageProvider lang={lang}>
          <ConsentProvider initial={consent}>
            <TooltipProvider delayDuration={300}>
              {children}
              <ConsentBanner />
              <ConsentPreferences />
              <Toaster />
            </TooltipProvider>
          </ConsentProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
