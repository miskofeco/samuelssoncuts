// Sent to a client when the barber blocks their account.
import { EmailHeading, EmailLayout, EmailParagraph } from "./layout";

export function AccountBlockedEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Your Samuelsson Cuts account access has been removed" accent="danger">
      <EmailHeading>Account access removed</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Your access to Samuelsson Cuts has been removed. Any pending appointments
        have been cancelled.
      </EmailParagraph>
      <EmailParagraph>
        If you believe this is a mistake, please contact us directly.
      </EmailParagraph>
    </EmailLayout>
  );
}
