// Sent to a client when their exact-slot request is confirmed directly.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function AppointmentConfirmedEmail({
  clientName,
  service,
  date,
  time,
}: {
  clientName: string;
  service: string;
  date: string;
  time: string;
}) {
  return (
    <EmailLayout preview="Your appointment is confirmed" accent="positive">
      <EmailHeading>Appointment confirmed</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>Your appointment has been confirmed. See you soon!</EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Date" value={date} />
        <EmailDetail label="Time" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/client/reservations`} accent="positive">
        View my appointments
      </EmailButton>
    </EmailLayout>
  );
}
