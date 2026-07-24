import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { formatEmailDate } from "../src/emails/date.ts";

const layout = readFileSync("src/emails/layout.tsx", "utf8");

for (const file of [
  "src/emails/appointment-cancelled.tsx",
  "src/emails/appointment-confirmed.tsx",
  "src/emails/appointment-proposed.tsx",
  "src/emails/appointment-reminder.tsx",
  "src/emails/appointment-rescheduled.tsx",
  "src/emails/booking-request.tsx",
  "src/emails/booking-received.tsx",
  "src/emails/barber-agenda.tsx",
  "src/emails/client-responded.tsx",
]) {
  test(`${file} formats date detail values for Slovak email display`, () => {
    const source = readFileSync(file, "utf8");
    assert.match(source, /formatEmailDate/);
    assert.doesNotMatch(source, /label="[^"]*date" value=\{date\}/i);
  });
}

test("email date format includes Slovak weekday and DD.MM.YYYY", () => {
  const source = readFileSync("src/emails/date.ts", "utf8");
  assert.match(source, /sk-SK/);
  assert.match(source, /weekday:\s*"long"/);
  assert.equal(formatEmailDate("2026-07-02"), "štvrtok 02.07.2026");
});

test("email layout uses Slovak language and copy", () => {
  assert.match(layout, /<Html lang="sk">/);
  assert.match(layout, /Tento email dostavate|Tento email dostávate/);
  assert.doesNotMatch(layout, /You&apos;re receiving this email/);
});

test("email layout avoids visible bordered containers", () => {
  const detailsBody = layout.slice(
    layout.indexOf("export function EmailDetails"),
    layout.indexOf("export function EmailDetail({"),
  );
  const layoutBody = layout.slice(
    layout.indexOf("export function EmailLayout"),
    layout.indexOf("export function EmailHeading"),
  );

  assert.doesNotMatch(layoutBody, /border border-/);
  assert.doesNotMatch(detailsBody, /border/);
});

test("email backgrounds use only white or neutral gray surfaces", () => {
  const emailSources = [
    "src/app/email-preview/page.tsx",
    "src/emails/layout.tsx",
    ...[
      "account-approved",
      "account-blocked",
      "account-rejected",
      "appointment-cancelled",
      "appointment-confirmed",
      "appointment-proposed",
      "appointment-reminder",
      "appointment-rescheduled",
      "auth-email",
      "barber-agenda",
      "booking-received",
      "booking-request",
      "client-responded",
      "slot-taken",
    ].map((name) => `src/emails/${name}.tsx`),
  ].map((file) => readFileSync(file, "utf8")).join("\n");

  assert.doesNotMatch(emailSources, /#f4f1ec|#ebe5dc/i);
  assert.match(layout, /bg-\[#f5f5f5\]/);
});

test("transactional email templates are localized to Slovak", () => {
  const sources = [
    "src/emails/account-approved.tsx",
    "src/emails/account-blocked.tsx",
    "src/emails/account-rejected.tsx",
    "src/emails/appointment-cancelled.tsx",
    "src/emails/appointment-confirmed.tsx",
    "src/emails/appointment-proposed.tsx",
    "src/emails/appointment-reminder.tsx",
    "src/emails/appointment-rescheduled.tsx",
    "src/emails/barber-agenda.tsx",
    "src/emails/booking-received.tsx",
    "src/emails/booking-request.tsx",
    "src/emails/client-responded.tsx",
    "src/emails/slot-taken.tsx",
  ].map((file) => readFileSync(file, "utf8")).join("\n");

  assert.match(sources, /Dobrý deň|Dobry den/);
  assert.match(sources, /Rezervácia|Rezervacia/);
  assert.match(sources, /Termín|Termin/);
  assert.doesNotMatch(sources, /<EmailParagraph>Hi /);
  assert.doesNotMatch(sources, /preview="Your /);
});

test("confirmed appointment email includes Google and Apple calendar actions", () => {
  const source = readFileSync("src/emails/appointment-confirmed.tsx", "utf8");
  const actions = readFileSync("src/app/actions.ts", "utf8");

  assert.match(source, /buildCalendarLinks/);
  assert.match(source, /Pridať do Google Kalendára|Pridat do Google Kalendara/);
  assert.match(source, /Pridať do Apple Kalendára|Pridat do Apple Kalendara/);
  assert.match(source, /startIso/);
  assert.match(source, /endIso/);
  assert.match(actions, /appointmentId/);
  assert.match(actions, /startIso: request\.requested_start/);
  assert.match(actions, /endIso: request\.requested_end/);
});

test("calendar link helpers build Google and Apple-compatible URLs", () => {
  const source = readFileSync("src/emails/calendar-links.ts", "utf8");
  const route = readFileSync("src/app/api/calendar/event/[appointmentId]/route.ts", "utf8");

  assert.match(source, /calendar\.google\.com\/calendar\/render/);
  assert.match(source, /\/api\/calendar\/event\/\$\{appointmentId\}/);
  assert.match(route, /Content-Type": "text\/calendar; charset=utf-8"/);
  assert.match(route, /appointmentUid\(appointment\.id\)/);
});

test("email preview page renders all templates in one place", () => {
  assert.equal(existsSync("src/app/email-preview/page.tsx"), true);
  const preview = readFileSync("src/app/email-preview/page.tsx", "utf8");

  assert.match(preview, /@react-email\/render/);
  assert.match(preview, /EMAIL_PREVIEWS/);
  assert.match(preview, /iframe/);
  assert.match(preview, /border: 0/);
  assert.match(preview, /AppointmentConfirmedEmail/);
  assert.match(preview, /AuthEmail/);
});

test("email preview page is disabled on Vercel deployments", () => {
  const preview = readFileSync("src/app/email-preview/page.tsx", "utf8");

  assert.match(preview, /notFound\(\)/);
  assert.match(preview, /process\.env\.VERCEL/);
});

test("email preview page is not covered by the cookie consent banner", () => {
  const consentBanner = readFileSync("src/components/consent/consent-banner.tsx", "utf8");

  assert.match(consentBanner, /pathname === "\/email-preview"/);
});
