// Sent to a client when their exact-slot request is confirmed directly.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { buildCalendarLinks } from "./calendar-links";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export function AppointmentConfirmedEmail({
  clientName,
  service,
  date,
  time,
  appointmentId,
  startIso,
  endIso,
}: {
  clientName: string;
  service: string;
  date: string;
  time: string;
  appointmentId: string;
  startIso: string;
  endIso: string;
}) {
  const formattedDate = formatEmailDate(date);
  const calendarLinks = buildCalendarLinks({
    appointmentId,
    service,
    startIso,
    endIso,
  });

  return (
    <EmailLayout preview="Váš termín je potvrdený" accent="positive">
      <EmailHeading>Termín je potvrdený</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>Rezervácia je potvrdená. Vidíme sa v dohodnutom čase.</EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Služba" value={service} />
        <EmailDetail label="Dátum" value={formattedDate} />
        <EmailDetail label="Čas" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/client/reservations`} accent="positive">
        Zobraziť rezervácie
      </EmailButton>
      <EmailButton href={calendarLinks.google} accent="positive">
        Pridať do Google Kalendára
      </EmailButton>
      <EmailButton href={calendarLinks.apple} accent="brand">
        Pridať do Apple Kalendára
      </EmailButton>
    </EmailLayout>
  );
}
