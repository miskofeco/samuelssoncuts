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
    <Html lang="sk">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="m-0 bg-[#f5f5f5] p-0 font-sans">
          <Container className="mx-auto w-full max-w-[600px] px-5 py-9">
            <Section className="pb-8 text-left">
              <Link href={siteUrl}>
                <Img
                  src={`${siteUrl}/logo-light.png`}
                  alt="Samuelsson Cuts"
                  width="172"
                  height="49"
                  className="h-auto w-[172px] max-w-full"
                />
              </Link>
            </Section>

            <Section className="py-1">{children}</Section>

            <Section className="pt-9 text-left">
              <Text className="m-0 text-xs font-semibold uppercase text-stone-500">
                Samuelsson Cuts
              </Text>
              <Text className="m-0 mt-1 text-xs text-stone-400">
                <Link href={siteUrl} className="text-stone-400 underline">
                  {siteUrl.replace(/^https?:\/\//, "")}
                </Link>
              </Text>
              <Text className="m-0 mt-3 text-[11px] leading-4 text-stone-500">
                Tento email dostávate, pretože máte účet alebo rezerváciu v
                Samuelsson Cuts.
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
    <Text className="mb-0 mt-0 text-[30px] font-bold leading-tight text-stone-950">
      {children}
    </Text>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text className="my-3 text-[16px] leading-7 text-stone-700">{children}</Text>
  );
}

export function EmailNote({ children }: { children: ReactNode }) {
  return (
    <Section className="my-6 rounded-xl bg-white px-5 py-4">
      <Text className="m-0 text-sm italic leading-6 text-stone-700">
        &ldquo;{children}&rdquo;
      </Text>
    </Section>
  );
}

export function EmailDetails({ children }: { children: ReactNode }) {
  return (
    <Section className="my-6 rounded-2xl bg-white px-5 py-2">
      {children}
    </Section>
  );
}

export function EmailDetail({ label, value }: { label: string; value: string }) {
  return (
    <Row>
      <Column className="py-3 pr-3 align-middle">
        <Text className="m-0 text-[13px] uppercase text-stone-500">{label}</Text>
      </Column>
      <Column className="py-3 text-right align-middle">
        <Text className="m-0 text-sm font-semibold text-stone-950">{value}</Text>
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
    <Section className="mt-7 text-left">
      <Link
        href={href}
        className="inline-block rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white no-underline"
        style={{ backgroundColor: BUTTON_BG[accent] }}
      >
        {children}
      </Link>
    </Section>
  );
}

export { Hr };
