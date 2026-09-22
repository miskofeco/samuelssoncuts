// Sent to the barber when a client accepts or declines a proposed time.
import { EmailAppointmentCard, EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
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
      <EmailHeading
        icon={accepted ? "tick" : "cancel"}
        accent={accepted ? "positive" : "danger"}
      >
        {accepted ? "Klient potvrdil termín" : "Klient termín nepotvrdil"}
      </EmailHeading>
      <EmailParagraph>
        <strong>{clientName}</strong>{" "}
        {accepted ? "potvrdil navrhnutý termín." : "nepotvrdil navrhnutý termín."}
      </EmailParagraph>
      <EmailAppointmentCard service={service} date={formattedDate} time={time} />
      <EmailButton href={`${getSiteUrl()}/admin/calendar`}>
        Otvoriť kalendár
      </EmailButton>
    </EmailLayout>
  );
}
