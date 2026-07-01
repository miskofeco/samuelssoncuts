import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { getSiteUrl } from "@/lib/env";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  const siteUrl = getSiteUrl();
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-stone-50 font-sans">
          <Container className="mx-auto max-w-[560px] py-10">
            {/* Logo / wordmark */}
            <Section className="mb-6 text-center">
              <Text className="m-0 text-xl font-bold tracking-tight text-stone-900">
                SAMUELSSON CUTS
              </Text>
            </Section>

            {/* Card */}
            <Section className="rounded-2xl bg-white px-8 py-8 shadow-sm">
              {children}
            </Section>

            {/* Footer */}
            <Hr className="my-6 border-stone-200" />
            <Text className="text-center text-xs text-stone-400">
              Samuelsson Cuts &middot;{" "}
              <a href={siteUrl} className="text-stone-400 underline">
                {siteUrl.replace(/^https?:\/\//, "")}
              </a>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-1 mt-0 text-2xl font-bold text-stone-900">{children}</Text>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return <Text className="my-3 text-base leading-relaxed text-stone-600">{children}</Text>;
}

export function EmailNote({ children }: { children: ReactNode }) {
  return (
    <Section className="my-4 rounded-xl bg-stone-50 px-4 py-3">
      <Text className="m-0 text-sm italic text-stone-500">&ldquo;{children}&rdquo;</Text>
    </Section>
  );
}

export function EmailDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Section className="mb-1">
      <Text className="m-0 text-sm text-stone-400">{label}</Text>
      <Text className="m-0 font-semibold text-stone-900">{value}</Text>
    </Section>
  );
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section className="mt-6 text-center">
      <a
        href={href}
        className="inline-block rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white no-underline"
      >
        {children}
      </a>
    </Section>
  );
}
