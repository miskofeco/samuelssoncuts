// Sent to a client when the barber proposes an alternative time.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
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
  const formattedDate = formatEmailDate(date);

  return (
    <EmailLayout preview={`Navrhnutý termín: ${formattedDate} o ${time}`}>
      <EmailHeading>Navrhnutý nový termín</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Pre vašu rezerváciu bol navrhnutý konkrétny termín. Prosím, potvrďte
        ho alebo odmietnite v klientskom účte.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Služba" value={service} />
        <EmailDetail label="Navrhnutý dátum" value={formattedDate} />
        <EmailDetail label="Navrhnutý čas" value={time} />
      </EmailDetails>
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        Zobraziť a odpovedať
      </EmailButton>
    </EmailLayout>
  );
}
