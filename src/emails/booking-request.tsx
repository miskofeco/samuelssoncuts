// Sent to the barber when a client submits a new booking request.
import { EmailAppointmentCard, EmailButton, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
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
    <EmailLayout preview={`${clientName} žiada termín ${formattedDate} o ${time}`}>
      <EmailHeading icon="inbox">Nová rezervácia</EmailHeading>
      <EmailParagraph>
        <strong>{clientName}</strong> poslal žiadosť o termín.
      </EmailParagraph>
      <EmailAppointmentCard service={service} date={formattedDate} time={time} />
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/admin/requests`}>
        Otvoriť žiadosti
      </EmailButton>
    </EmailLayout>
  );
}
