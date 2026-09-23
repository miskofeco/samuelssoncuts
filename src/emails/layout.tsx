import {
  Body,
  Button,
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

import { getEmailAssetOrigin, getSiteUrl } from "@/lib/env";

export type EmailAccent = "brand" | "positive" | "danger" | "neutral";

// Remote images are fetched by the recipient's mail client (or Gmail's proxy)
// with no session, so every `src` must be an absolute public HTTPS URL.
// `getEmailAssetOrigin()` never resolves to localhost or a protected preview.
function emailAssetUrl(path: string) {
  return `${getEmailAssetOrigin()}${path}`;
}

// Alt text is the fallback when a client blocks images; style it so the
// wordmark still reads as a heading instead of a broken-image glyph.
const LOGO_ALT_STYLE = {
  border: 0,
  outline: "none",
  textDecoration: "none",
  color: "#1c1917",
  fontSize: 16,
  fontWeight: 700,
  lineHeight: "49px",
} as const;

export type EmailIconName =
  | "alert"
  | "apple"
  | "calendar"
  | "calendar-check"
  | "cancel"
  | "clock"
  | "google"
  | "inbox"
  | "key"
  | "lock"
  | "note"
  | "notification"
  | "refresh"
  | "scissors"
  | "shield"
  | "tick"
  | "user"
  | "user-block"
  | "user-check";

const BUTTON_BG: Record<EmailAccent, string> = {
  brand: "#1c1917",
  positive: "#047857",
  danger: "#b91c1c",
  neutral: "#1c1917",
};

const ACCENT_SURFACE: Record<EmailAccent, string> = {
  brand: "#f5f5f4",
  positive: "#d1fae5",
  danger: "#fee2e2",
  neutral: "#f5f5f4",
};

const ACCENT_FOREGROUND: Record<EmailAccent, string> = {
  brand: "#1c1917",
  positive: "#065f46",
  danger: "#991b1b",
  neutral: "#57534e",
};

function EmailIcon({ name, size = 20 }: { name: EmailIconName; size?: number }) {
  return (
    <Img
      src={emailAssetUrl(`/email-icons/${name}.png`)}
      alt=""
      width={size}
      height={size}
      style={{
        display: "block",
        height: size,
        width: size,
        margin: "0 auto",
        border: 0,
        outline: "none",
        textDecoration: "none",
      }}
    />
  );
}

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
        <Body className="m-0 bg-[#f5f5f5] p-0 font-sans text-stone-950">
          <Container className="mx-auto w-full max-w-[600px] px-4 py-8">
            <Section className="pb-6 text-left">
              <Link href={siteUrl} aria-label="Samuelsson Cuts">
                <Img
                  src={emailAssetUrl("/logo-light.png")}
                  alt="Samuelsson Cuts"
                  width="172"
                  height="49"
                  className="h-auto w-[172px] max-w-full"
                  style={LOGO_ALT_STYLE}
                />
              </Link>
            </Section>

            <Section className="rounded-2xl bg-white px-5 py-7">
              {children}
            </Section>

            <Section className="px-1 pt-7 text-left">
              <Text className="m-0 text-xs font-semibold text-stone-700">
                Samuelsson Cuts
              </Text>
              <Text className="m-0 mt-1 text-xs text-stone-500">
                <Link href={siteUrl} className="text-stone-500 underline">
                  {siteUrl.replace(/^https?:\/\//, "")}
                </Link>
              </Text>
              <Text className="m-0 mt-3 max-w-[480px] text-[11px] leading-4 text-stone-500">
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

export function EmailHeading({
  children,
  icon,
  accent = "brand",
}: {
  children: ReactNode;
  icon?: EmailIconName;
  accent?: EmailAccent;
}) {
  return (
    <Section className="mb-6">
      {icon ? (
        <Row className="mb-4">
          <Column
            width={48}
            height={48}
            className="rounded-xl"
            style={{
              width: 48,
              minWidth: 48,
              maxWidth: 48,
              height: 48,
              padding: 0,
              textAlign: "center",
              verticalAlign: "middle",
              backgroundColor: ACCENT_SURFACE[accent],
              color: ACCENT_FOREGROUND[accent],
            }}
          >
            <EmailIcon name={icon} size={24} />
          </Column>
          <Column />
        </Row>
      ) : null}
      <Text className="m-0 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-stone-950">
        {children}
      </Text>
    </Section>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text className="my-3 text-[16px] leading-7 text-stone-700">{children}</Text>
  );
}

export function EmailNote({ children }: { children: ReactNode }) {
  return (
    <Section className="my-6 rounded-xl bg-stone-100 px-4 py-4">
      <Row>
        <Column className="w-9 pr-3 align-top">
          <EmailIcon name="note" size={18} />
        </Column>
        <Column className="align-top">
          <Text className="m-0 text-xs font-semibold text-stone-500">Poznámka</Text>
          <Text className="m-0 mt-1 text-sm leading-6 text-stone-700">{children}</Text>
        </Column>
      </Row>
    </Section>
  );
}

export function EmailDetails({ children }: { children: ReactNode }) {
  return (
    <Section className="my-6 rounded-xl bg-stone-100 px-4 py-2">
      {children}
    </Section>
  );
}

export function EmailDetail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: EmailIconName;
}) {
  return (
    <Row>
      {icon ? (
        <Column className="w-9 py-3 pr-3 align-middle">
          <EmailIcon name={icon} size={18} />
        </Column>
      ) : null}
      <Column className="py-3 align-middle">
        <Text className="m-0 text-xs font-medium text-stone-500">{label}</Text>
        <Text className="m-0 mt-0.5 text-sm font-semibold leading-5 text-stone-950">
          {value}
        </Text>
      </Column>
    </Row>
  );
}

export function EmailAppointmentCard({
  service,
  date,
  time,
  dateLabel = "Dátum",
  timeLabel = "Čas",
}: {
  service: string;
  date: string;
  time: string;
  dateLabel?: string;
  timeLabel?: string;
}) {
  return (
    <Section className="my-6 rounded-xl bg-stone-100 px-4 py-4">
      <Row>
        <Column className="w-9 pr-3 align-middle">
          <EmailIcon name="scissors" size={18} />
        </Column>
        <Column className="align-middle">
          <Text className="m-0 text-xs font-medium text-stone-500">Služba</Text>
          <Text className="m-0 mt-0.5 text-[15px] font-semibold text-stone-950">
            {service}
          </Text>
        </Column>
      </Row>
      <Hr className="my-4 border-stone-200" />
      <Row>
        <Column className="w-9 pr-3 align-top">
          <EmailIcon name="calendar" size={18} />
        </Column>
        <Column className="align-top">
          <Text className="m-0 text-xs font-medium text-stone-500">{dateLabel}</Text>
          <Text className="m-0 mt-1 text-sm font-semibold leading-5 text-stone-950">
            {date}
          </Text>
        </Column>
      </Row>
      <Hr className="my-4 border-stone-200" />
      <Row>
        <Column className="w-9 pr-3 align-top">
          <EmailIcon name="clock" size={18} />
        </Column>
        <Column className="align-top">
          <Text className="m-0 text-xs font-medium text-stone-500">{timeLabel}</Text>
          <Text className="m-0 mt-1 text-sm font-semibold leading-5 text-stone-950">
            {time}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}

export function EmailButton({
  href,
  accent = "brand",
  icon,
  variant = "primary",
  compact = false,
  children,
}: {
  href: string;
  accent?: EmailAccent;
  icon?: EmailIconName;
  variant?: "primary" | "secondary" | "apple";
  compact?: boolean;
  children: ReactNode;
}) {
  const secondary = variant === "secondary";
  const apple = variant === "apple";

  return (
    <Section className={compact ? "mt-3" : "mt-7"}>
      <Button
        href={href}
        className="box-border block w-full rounded-xl px-5 py-3.5 text-center text-[15px] font-semibold no-underline"
        style={{
          backgroundColor: apple ? "#000000" : secondary ? "#f5f5f4" : BUTTON_BG[accent],
          color: apple ? "#ffffff" : secondary ? "#1c1917" : "#ffffff",
        }}
      >
        {icon ? (
          <span style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }}>
            <EmailIcon name={icon} size={18} />
          </span>
        ) : null}
        <span style={{ verticalAlign: "middle" }}>{children}</span>
      </Button>
    </Section>
  );
}

export function EmailCalendarActions({
  googleHref,
  appleHref,
}: {
  googleHref: string;
  appleHref: string;
}) {
  return (
    <Section className="mt-7">
      <Text className="m-0 text-xs font-semibold text-stone-500">
        Pridať do kalendára
      </Text>
      <EmailButton href={googleHref} icon="google" variant="secondary" compact>
        Google Kalendár
      </EmailButton>
      <EmailButton href={appleHref} icon="apple" variant="apple" compact>
        Apple Kalendár
      </EmailButton>
    </Section>
  );
}

export { Hr };
