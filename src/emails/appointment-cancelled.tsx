// Sent to a client when the barber cancels their confirmed appointment.
import { EmailButton, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function AppointmentCancelledEmail({
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
    <EmailLayout preview="Your appointment has been cancelled">
      <EmailHeading>Appointment cancelled</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Your <strong>{service}</strong> appointment on <strong>{date} at {time}</strong> has been cancelled.
        We apologise for the inconvenience.
      </EmailParagraph>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/book`}>Book a new appointment</EmailButton>
    </EmailLayout>
  );
}
