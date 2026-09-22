// Sent to a client when the barber approves their account.
import { EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function AccountApprovedEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Váš účet v Samuelsson Cuts bol schválený" accent="positive">
      <EmailHeading icon="user-check" accent="positive">Účet je schválený</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Váš účet v Samuelsson Cuts je aktívny. Odteraz si môžete rezervovať
        termín priamo v klientskom účte.
      </EmailParagraph>
      <EmailButton href={`${getSiteUrl()}/client/book`} accent="positive">
        Rezervovať termín
      </EmailButton>
    </EmailLayout>
  );
}
