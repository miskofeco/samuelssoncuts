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
    <EmailLayout preview="Your appointment is confirmed" accent="positive">
      <EmailHeading>Appointment confirmed</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>Your appointment has been confirmed. See you soon!</EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Date" value={formattedDate} />
        <EmailDetail label="Time" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/client/reservations`} accent="positive">
        View my appointments
      </EmailButton>
      <EmailButton href={calendarLinks.google} accent="positive">
        Add to Google Calendar
      </EmailButton>
      <EmailButton href={calendarLinks.apple} accent="brand">
        Add to Apple Calendar
      </EmailButton>
    </EmailLayout>
  );
}
