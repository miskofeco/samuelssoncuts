// Sent to the barber when a client submits a new booking request.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
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
  const formattedDate = formatEmailDate(date);

  return (
    <EmailLayout preview={`${clientName} requested ${formattedDate} at ${time}`}>
      <EmailHeading>New booking request</EmailHeading>
      <EmailParagraph>
        <strong>{clientName}</strong> has requested an appointment.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Date" value={formattedDate} />
        <EmailDetail label="Time" value={time} />
      </EmailDetails>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/admin/requests`}>
        Review in admin panel
      </EmailButton>
    </EmailLayout>
  );
}
