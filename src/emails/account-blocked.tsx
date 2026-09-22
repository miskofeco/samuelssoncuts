// Sent to a client when the barber blocks their account.
import { EmailHeading, EmailLayout, EmailParagraph } from "./layout";

export function AccountBlockedEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Prístup k účtu Samuelsson Cuts bol zrušený" accent="danger">
      <EmailHeading icon="user-block" accent="danger">Prístup bol zrušený</EmailHeading>
      <EmailParagraph>Dobrý deň, {clientName},</EmailParagraph>
      <EmailParagraph>
        Prístup k účtu Samuelsson Cuts bol zrušený. Všetky rozpracované
        rezervácie a budúce termíny boli zrušené.
      </EmailParagraph>
      <EmailParagraph>
        Ak si myslíte, že ide o omyl, kontaktujte nás priamo odpoveďou na tento email.
      </EmailParagraph>
    </EmailLayout>
  );
}
