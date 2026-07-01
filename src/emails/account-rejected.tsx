// Sent to a client when the barber rejects their account.
import { EmailHeading, EmailLayout, EmailParagraph } from "./layout";

export function AccountRejectedEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Update on your Samuelsson Cuts account">
      <EmailHeading>Account update</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Thank you for registering with Samuelsson Cuts. Unfortunately we are
        unable to approve your account at this time.
      </EmailParagraph>
      <EmailParagraph>
        If you think this is a mistake, please reply to this email.
      </EmailParagraph>
    </EmailLayout>
  );
}
