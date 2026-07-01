// Sent to a client when the barber approves their account.
import { EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function AccountApprovedEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Your Samuelsson Cuts account is approved">
      <EmailHeading>You&apos;re approved!</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Your Samuelsson Cuts account has been approved. You can now book
        appointments directly.
      </EmailParagraph>
      <EmailButton href={`${getSiteUrl()}/client/book`}>Book your first appointment</EmailButton>
    </EmailLayout>
  );
}
