// Sent ~24 hours before a confirmed appointment.
import { EmailAppointmentCard, EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
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
      <EmailHeading icon="notification">Pripomienka termínu</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Pripomíname váš termín, ktorý máte naplánovaný na zajtra.
      </EmailParagraph>
      <EmailAppointmentCard service={service} date={formattedDate} time={time} />
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        Zobraziť rezervácie
      </EmailButton>
    </EmailLayout>
  );
}
