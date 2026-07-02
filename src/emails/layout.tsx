import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { getSiteUrl } from "@/lib/env";

// Semantic accent applied to CTA buttons. Colors mirror the app palette:
// emerald = positive, red = attention/negative, stone = neutral/brand.
export type EmailAccent = "brand" | "positive" | "danger" | "neutral";

const BUTTON_BG: Record<EmailAccent, string> = {
  brand: "#0c0a09",
  positive: "#059669",
  danger: "#dc2626",
  neutral: "#0c0a09",
};

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  accent?: EmailAccent;
  children: ReactNode;
}) {
  const siteUrl = getSiteUrl();
  return (
    <Html lang="en">
      <Head>
        {/* Ensure mobile clients render at device width instead of a zoomed-out
            desktop layout (which would clip the card). */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind>
        {/* Full-bleed neutral canvas; the inner container is fluid up to 600px
            so it fills the width of any phone screen and centers on desktop. */}
        <Body className="m-0 bg-stone-100 p-0 font-sans">
          <Container className="mx-auto w-full max-w-[600px] px-4 py-8">
            {/* Brand logo (absolute URL — email clients can't resolve /paths).
                logo-light.png is the black wordmark, suited to the light card. */}
            <Section className="mb-6 text-center">
              <Link href={siteUrl}>
                <Img
                  src={`${siteUrl}/logo-light.png`}
                  alt="Samuelsson Cuts"
                  width="180"
                  height="51"
                  className="mx-auto h-auto w-[180px] max-w-full"
                />
              </Link>
            </Section>

            {/* Card */}
            <Section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <Section className="px-7 py-8">{children}</Section>
            </Section>

            {/* Footer */}
            <Section className="px-2 pt-6 text-center">
              <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-stone-500">
                Samuelsson Cuts
              </Text>
              <Text className="m-0 mt-1 text-xs text-stone-400">
                <Link href={siteUrl} className="text-stone-400 underline">
                  {siteUrl.replace(/^https?:\/\//, "")}
                </Link>
              </Text>
              <Text className="m-0 mt-3 text-[11px] leading-4 text-stone-400">
                You&apos;re receiving this email because you have an account or a
                booking with Samuelsson Cuts.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-0 mt-0 text-2xl font-bold leading-tight text-stone-900">
      {children}
    </Text>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text className="my-3 text-base leading-relaxed text-stone-600">{children}</Text>
  );
}

// Left-border callout for a client/barber note.
export function EmailNote({ children }: { children: ReactNode }) {
  return (
    <Section
      className="my-5 rounded-r-lg bg-stone-50 py-3 pl-4 pr-4"
      style={{ borderLeft: "3px solid #d6d3d1" }}
    >
      <Text className="m-0 text-sm italic leading-relaxed text-stone-600">
        &ldquo;{children}&rdquo;
      </Text>
    </Section>
  );
}

// Grouped details panel. Wrap one or more <EmailDetail> rows so they read as a
// single bordered block instead of loose stacked text.
export function EmailDetails({ children }: { children: ReactNode }) {
  return (
    <Section className="my-5 rounded-xl border-x border-b border-stone-200 bg-stone-50 px-5 py-2">
      {children}
    </Section>
  );
}

// One label/value line. Label left, value right, vertically aligned — a table
// row so it stays aligned across email clients (no flexbox reliance).
export function EmailDetail({ label, value }: { label: string; value: string }) {
  return (
    <Row className="border-b border-stone-200/70">
      <Column className="py-3 pr-3 align-middle">
        <Text className="m-0 text-sm text-stone-500">{label}</Text>
      </Column>
      <Column className="py-3 text-right align-middle">
        <Text className="m-0 text-sm font-semibold text-stone-900">{value}</Text>
      </Column>
    </Row>
  );
}

export function EmailButton({
  href,
  accent = "brand",
  children,
}: {
  href: string;
  accent?: EmailAccent;
  children: ReactNode;
}) {
  return (
    <Section className="mt-7 text-center">
      <Link
        href={href}
        className="inline-block rounded-xl px-7 py-3.5 text-base font-semibold text-white no-underline"
        style={{ backgroundColor: BUTTON_BG[accent] }}
      >
        {children}
      </Link>
    </Section>
  );
}

// Kept for API stability if any template imports it directly.
export { Hr };
