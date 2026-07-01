// Sent to a client when the barber reschedules a confirmed appointment.
import { EmailButton, EmailDetail, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
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
  return (
    <EmailLayout preview={`Your appointment was moved — new time ${date} at ${time}`}>
      <EmailHeading>Appointment rescheduled</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Your barber has moved your appointment to a new time. Please accept or
        decline the new proposal.
      </EmailParagraph>
      <EmailDetail label="Service" value={service} />
      <EmailDetail label="New date" value={date} />
      <EmailDetail label="New time" value={time} />
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        View &amp; respond
      </EmailButton>
    </EmailLayout>
  );
}
