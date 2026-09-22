// Sent to a client immediately after they place a booking request, so they get
// an acknowledgement before the barber confirms (previously only the barber was
// emailed at request time).
import { EmailAppointmentCard, EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export function BookingReceivedEmail({
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
    <EmailLayout preview="Vašu rezerváciu sme prijali" accent="brand">
      <EmailHeading icon="inbox">Rezervácia je prijatá</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Žiadosť o termín sme prijali. Po potvrdení dostanete ďalší email.
      </EmailParagraph>
      <EmailAppointmentCard
        service={service}
        date={formattedDate}
        time={time}
        dateLabel="Požadovaný dátum"
        timeLabel="Požadovaný čas"
      />
      <EmailButton href={`${getSiteUrl()}/client/reservations`} accent="brand">
        Zobraziť rezervácie
      </EmailButton>
    </EmailLayout>
  );
}
