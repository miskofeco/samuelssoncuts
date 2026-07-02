// Sent to a client when the barber cancels their confirmed appointment.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
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
  const formattedDate = formatEmailDate(date);

  return (
    <EmailLayout preview="Your appointment has been cancelled" accent="danger">
      <EmailHeading>Appointment cancelled</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        The following appointment has been cancelled. We apologise for the
        inconvenience.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Date" value={formattedDate} />
        <EmailDetail label="Time" value={time} />
      </EmailDetails>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/book`}>Book a new appointment</EmailButton>
    </EmailLayout>
  );
}
