// Sent to a client when their exact-slot request is confirmed directly.
import { EmailAppointmentCard, EmailButton, EmailCalendarActions, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
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
      <EmailHeading icon="calendar-check" accent="positive">Termín je potvrdený</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>Rezervácia je potvrdená. Vidíme sa v dohodnutom čase.</EmailParagraph>
      <EmailAppointmentCard service={service} date={formattedDate} time={time} />
      <EmailButton href={`${getSiteUrl()}/client/reservations`} accent="positive">
        Zobraziť rezervácie
      </EmailButton>
      <EmailCalendarActions
        googleHref={calendarLinks.google}
        appleHref={calendarLinks.apple}
      />
    </EmailLayout>
  );
}
