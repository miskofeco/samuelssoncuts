// Sent to a client when the barber rejects their account.
import { EmailHeading, EmailLayout, EmailParagraph } from "./layout";

export function AccountRejectedEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Informácia k vášmu účtu Samuelsson Cuts" accent="danger">
      <EmailHeading>Účet nebol schválený</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Ďakujeme za registráciu v Samuelsson Cuts. Váš účet momentálne nevieme
        schváliť.
      </EmailParagraph>
      <EmailParagraph>
        Ak si myslíte, že ide o omyl, odpovedzte na tento email.
      </EmailParagraph>
    </EmailLayout>
  );
}
