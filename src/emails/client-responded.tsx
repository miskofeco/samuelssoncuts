// Sent to the barber when a client accepts or declines a proposed time.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export function ClientRespondedEmail({
  clientName,
  service,
  date,
  time,
  accepted,
}: {
  clientName: string;
  service: string;
  date: string;
  time: string;
  accepted: boolean;
}) {
  const formattedDate = formatEmailDate(date);

  return (
    <EmailLayout
      accent={accepted ? "positive" : "danger"}
      preview={
        accepted
          ? `${clientName} potvrdil termín`
          : `${clientName} termín nepotvrdil`
      }
    >
      <EmailHeading>
        {accepted ? "Klient potvrdil termín" : "Klient termín nepotvrdil"}
      </EmailHeading>
      <EmailParagraph>
        <strong>{clientName}</strong>{" "}
        {accepted ? "potvrdil navrhnutý termín." : "nepotvrdil navrhnutý termín."}
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Služba" value={service} />
        <EmailDetail label="Dátum" value={formattedDate} />
        <EmailDetail label="Čas" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/admin/calendar`}>
        Otvoriť kalendár
      </EmailButton>
    </EmailLayout>
  );
}
