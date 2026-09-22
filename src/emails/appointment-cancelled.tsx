// Sent to a client when the barber cancels their confirmed appointment.
import { EmailAppointmentCard, EmailButton, EmailHeading, EmailLayout, EmailNote, EmailParagraph } from "./layout";
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
    <EmailLayout preview="Váš termín bol zrušený" accent="danger">
      <EmailHeading icon="cancel" accent="danger">Termín bol zrušený</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Tento termín bol zrušený. Ospravedlňujeme sa za nepríjemnosť.
      </EmailParagraph>
      <EmailAppointmentCard service={service} date={formattedDate} time={time} />
      {note ? <EmailNote>{note}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/book`}>Vybrať nový termín</EmailButton>
    </EmailLayout>
  );
}
