// Sent to a client when the barber reschedules a confirmed appointment.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export function AppointmentRescheduledEmail({
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
  const formattedDate = formatEmailDate(date);

  return (
    <EmailLayout preview={`Your appointment was moved — new time ${formattedDate} at ${time}`}>
      <EmailHeading>Appointment rescheduled</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Your barber has moved your appointment to a new time. Please accept or
        decline the new proposal.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="New date" value={formattedDate} />
        <EmailDetail label="New time" value={time} />
      </EmailDetails>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        View &amp; respond
      </EmailButton>
    </EmailLayout>
  );
}
