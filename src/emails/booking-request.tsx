// Sent to the barber when a client submits a new booking request.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function BookingRequestEmail({
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
    <EmailLayout preview={`${clientName} requested ${date} at ${time}`}>
      <EmailHeading>New booking request</EmailHeading>
      <EmailParagraph>
        <strong>{clientName}</strong> has requested an appointment.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Date" value={date} />
        <EmailDetail label="Time" value={time} />
      </EmailDetails>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/admin/requests`}>
        Review in admin panel
      </EmailButton>
    </EmailLayout>
  );
}
