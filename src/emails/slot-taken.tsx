// Sent to clients whose pending request was auto-declined because the barber
// confirmed the same slot for someone else.
import { EmailButton, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function SlotTakenEmail({ clientName }: { clientName: string }) {
  return (
    <EmailLayout preview="Your requested time was just booked by someone else" accent="danger">
      <EmailHeading>Time slot no longer available</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Unfortunately the time you requested was just confirmed for another
        client. Please choose a different slot.
      </EmailParagraph>
      <EmailButton href={`${getSiteUrl()}/client/book`}>Pick a new time</EmailButton>
    </EmailLayout>
  );
}
