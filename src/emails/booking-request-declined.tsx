import { getSiteUrl } from "@/lib/env";

import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailNote,
  EmailParagraph,
} from "./layout";

export function BookingRequestDeclinedEmail({
  clientName,
  reason,
}: {
  clientName: string;
  reason?: string | null;
}) {
  return (
    <EmailLayout preview="Vaša žiadosť o rezerváciu bola odmietnutá" accent="danger">
      <EmailHeading>Žiadosť bola odmietnutá</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Váš požadovaný termín sa nám tentoraz nepodarilo potvrdiť. Môžete si vybrať iný
        termín a poslať novú žiadosť.
      </EmailParagraph>
      {reason ? <EmailNote>{reason}</EmailNote> : null}
      <EmailButton href={`${getSiteUrl()}/client/book`}>Vybrať iný termín</EmailButton>
    </EmailLayout>
  );
}
