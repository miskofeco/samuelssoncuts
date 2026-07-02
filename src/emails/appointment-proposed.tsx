// Sent to a client when the barber proposes an alternative time.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function AppointmentProposedEmail({
  clientName,
  service,
  date,
  time,
  note,
}: {
  clientName: string;
  service: string;
  date: string;
  time: string;
  note?: string | null;
}) {
  return (
    <EmailLayout preview={`Appointment proposed for ${date} at ${time}`}>
      <EmailHeading>New time proposed</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Your barber has proposed a time for your appointment. Please review and
        accept or decline.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Proposed date" value={date} />
        <EmailDetail label="Proposed time" value={time} />
      </EmailDetails>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        View &amp; respond
      </EmailButton>
    </EmailLayout>
  );
}
