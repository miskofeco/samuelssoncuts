// Sent ~24 hours before a confirmed appointment.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export function AppointmentReminderEmail({
  clientName,
  service,
  date,
  time,
}: {
  clientName: string;
  service: string;
  date: string;
  time: string;
}) {
  const formattedDate = formatEmailDate(date);

  return (
    <EmailLayout preview={`Pripomienka: termín zajtra o ${time}`}>
      <EmailHeading>Pripomienka termínu</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Pripomíname váš termín, ktorý máte naplánovaný na zajtra.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Služba" value={service} />
        <EmailDetail label="Dátum" value={formattedDate} />
        <EmailDetail label="Čas" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        Zobraziť rezervácie
      </EmailButton>
    </EmailLayout>
  );
}
