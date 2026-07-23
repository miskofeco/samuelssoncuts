// Sent to a client immediately after they place a booking request, so they get
// an acknowledgement before the barber confirms (previously only the barber was
// emailed at request time).
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
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
      <EmailHeading>Rezervácia je prijatá</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Žiadosť o termín sme prijali. Po potvrdení dostanete ďalší email.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Služba" value={service} />
        <EmailDetail label="Požadovaný dátum" value={formattedDate} />
        <EmailDetail label="Požadovaný čas" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/client/reservations`} accent="brand">
        Zobraziť rezervácie
      </EmailButton>
    </EmailLayout>
  );
}
