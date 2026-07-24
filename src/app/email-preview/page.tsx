import { render } from "@react-email/render";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { AccountApprovedEmail } from "@/emails/account-approved";
import { AccountBlockedEmail } from "@/emails/account-blocked";
import { AccountRejectedEmail } from "@/emails/account-rejected";
import { AppointmentCancelledEmail } from "@/emails/appointment-cancelled";
import { AppointmentConfirmedEmail } from "@/emails/appointment-confirmed";
import { AppointmentProposedEmail } from "@/emails/appointment-proposed";
import { AppointmentReminderEmail } from "@/emails/appointment-reminder";
import { AppointmentRescheduledEmail } from "@/emails/appointment-rescheduled";
import { AuthEmail } from "@/emails/auth-email";
import { BarberAgendaEmail } from "@/emails/barber-agenda";
import { BookingReceivedEmail } from "@/emails/booking-received";
import { BookingRequestEmail } from "@/emails/booking-request";
import { ClientRespondedEmail } from "@/emails/client-responded";
import { SlotTakenEmail } from "@/emails/slot-taken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email preview - Samuelsson Cuts",
  robots: { index: false, follow: false },
};

type EmailPreview = {
  title: string;
  description: string;
  component: ReactElement;
};

const SAMPLE = {
  clientName: "Martin Kováč",
  service: "Strih + úprava brady",
  date: "2026-07-24",
  time: "14:30",
  appointmentId: "preview-appointment",
  startIso: "2026-07-24T12:30:00.000Z",
  endIso: "2026-07-24T13:30:00.000Z",
  note: "Prosím prísť o pár minút skôr, aby sme stihli konzultáciu pred strihom.",
  confirmUrl: "https://samuelssoncuts.sk/auth/confirm?token_hash=preview&type=signup",
};

const EMAIL_PREVIEWS: EmailPreview[] = [
  {
    title: "Schválený účet",
    description: "Klient dostane prístup k rezerváciám.",
    component: <AccountApprovedEmail clientName={SAMPLE.clientName} />,
  },
  {
    title: "Zamietnutý účet",
    description: "Registrácia nebola schválená.",
    component: <AccountRejectedEmail clientName={SAMPLE.clientName} />,
  },
  {
    title: "Zablokovaný účet",
    description: "Prístup klienta bol zrušený.",
    component: <AccountBlockedEmail clientName={SAMPLE.clientName} />,
  },
  {
    title: "Nová rezervácia pre barbera",
    description: "Klient poslal žiadosť o termín.",
    component: (
      <BookingRequestEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
        note={SAMPLE.note}
      />
    ),
  },
  {
    title: "Rezervácia prijatá",
    description: "Potvrdenie prijatia žiadosti pre klienta.",
    component: (
      <BookingReceivedEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
      />
    ),
  },
  {
    title: "Navrhnutý termín",
    description: "Barber poslal klientovi konkrétny návrh.",
    component: (
      <AppointmentProposedEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
        note={SAMPLE.note}
      />
    ),
  },
  {
    title: "Potvrdený termín",
    description: "Klientov termín je potvrdený a obsahuje kalendáre.",
    component: (
      <AppointmentConfirmedEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
        appointmentId={SAMPLE.appointmentId}
        startIso={SAMPLE.startIso}
        endIso={SAMPLE.endIso}
      />
    ),
  },
  {
    title: "Pripomienka termínu",
    description: "Email odoslaný približne deň pred termínom.",
    component: (
      <AppointmentReminderEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
      />
    ),
  },
  {
    title: "Presunutý termín",
    description: "Klient musí potvrdiť nový návrh.",
    component: (
      <AppointmentRescheduledEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
        note={SAMPLE.note}
      />
    ),
  },
  {
    title: "Zrušený termín",
    description: "Barber zrušil potvrdený termín.",
    component: (
      <AppointmentCancelledEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
        note={SAMPLE.note}
      />
    ),
  },
  {
    title: "Termín obsadený",
    description: "Požadovaný čas bol potvrdený pre inú rezerváciu.",
    component: <SlotTakenEmail clientName={SAMPLE.clientName} />,
  },
  {
    title: "Klient potvrdil návrh",
    description: "Notifikácia pre barbera.",
    component: (
      <ClientRespondedEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
        accepted
      />
    ),
  },
  {
    title: "Klient odmietol návrh",
    description: "Notifikácia pre barbera.",
    component: (
      <ClientRespondedEmail
        clientName={SAMPLE.clientName}
        service={SAMPLE.service}
        date={SAMPLE.date}
        time={SAMPLE.time}
        accepted={false}
      />
    ),
  },
  {
    title: "Denný prehľad",
    description: "Ranný zoznam potvrdených termínov pre barbera.",
    component: (
      <BarberAgendaEmail
        date={SAMPLE.date}
        items={[
          { time: "09:00", service: "Pánsky strih", customer: "Adam Novák" },
          { time: "10:30", service: "Strih + brada", customer: "Martin Kováč" },
          { time: "14:30", service: "Úprava brady", customer: "Peter Horváth" },
        ]}
      />
    ),
  },
  {
    title: "Auth - registrácia",
    description: "Potvrdenie emailu po registrácii.",
    component: <AuthEmail kind="signup" confirmUrl={SAMPLE.confirmUrl} />,
  },
  {
    title: "Auth - obnova hesla",
    description: "Nastavenie nového hesla.",
    component: <AuthEmail kind="recovery" confirmUrl={SAMPLE.confirmUrl} />,
  },
  {
    title: "Auth - prihlasovací odkaz",
    description: "Jednorazový magic link.",
    component: <AuthEmail kind="magiclink" confirmUrl={SAMPLE.confirmUrl} />,
  },
  {
    title: "Auth - zmena emailu",
    description: "Potvrdenie novej emailovej adresy.",
    component: <AuthEmail kind="email_change" confirmUrl={SAMPLE.confirmUrl} />,
  },
];

export default async function EmailPreviewPage() {
  if (process.env.VERCEL) {
    notFound();
  }

  const previews = await Promise.all(
    EMAIL_PREVIEWS.map(async (preview) => ({
      ...preview,
      html: await render(preview.component, { pretty: true }),
    })),
  );

  return (
    <main className="min-h-screen bg-[#f5f5f5] px-5 py-8 text-stone-950">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="m-0 text-sm font-semibold uppercase text-stone-500">
            Samuelsson Cuts
          </p>
          <h1 className="m-0 mt-2 text-3xl font-semibold">Email preview</h1>
        </header>

        <div className="grid gap-7 lg:grid-cols-2">
          {previews.map((preview) => (
            <section key={preview.title} className="min-w-0">
              <div className="mb-3">
                <h2 className="m-0 text-lg font-semibold">{preview.title}</h2>
                <p className="m-0 mt-1 text-sm text-stone-600">{preview.description}</p>
              </div>
              <iframe
                title={preview.title}
                srcDoc={preview.html}
                className="h-[720px] w-full rounded-lg bg-white shadow-sm"
                style={{ border: 0 }}
              />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
