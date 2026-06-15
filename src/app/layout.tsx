import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { ConsentPreferences } from "@/components/consent/consent-preferences";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { ThemeScript } from "@/components/shared/theme-script";
import { LanguageProvider } from "@/i18n/provider";
import { getConsent } from "@/lib/consent/server";
import { getDict, getLang } from "@/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDict();
  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  const consent = await getConsent();

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <ThemeScript />
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
