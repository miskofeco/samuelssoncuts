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
    <EmailLayout preview={`Termín bol presunutý: ${formattedDate} o ${time}`}>
      <EmailHeading>Termín bol presunutý</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Váš termín bol presunutý na nový návrh. Prosím, potvrďte ho alebo
        odmietnite v klientskom účte.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Služba" value={service} />
        <EmailDetail label="Nový dátum" value={formattedDate} />
        <EmailDetail label="Nový čas" value={time} />
      </EmailDetails>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        Zobraziť a odpovedať
      </EmailButton>
    </EmailLayout>
  );
}
