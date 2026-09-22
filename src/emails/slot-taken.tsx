// Sent to clients whose pending request was auto-declined because the barber
// confirmed the same slot for someone else.
import { EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function SlotTakenEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Požadovaný termín už nie je dostupný" accent="danger">
      <EmailHeading icon="alert" accent="danger">Termín už nie je dostupný</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Požadovaný čas bol práve potvrdený pre inú rezerváciu. Vyberte si,
        prosím, nový termín.
      </EmailParagraph>
      <EmailButton href={`${getSiteUrl()}/client/book`}>Vybrať nový termín</EmailButton>
    </EmailLayout>
  );
}
