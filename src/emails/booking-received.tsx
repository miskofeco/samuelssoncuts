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
    <EmailLayout preview="We received your booking request" accent="brand">
      <EmailHeading>Request received</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Thanks for your request — we&rsquo;ve got it and the barber will confirm your
        time shortly. You&rsquo;ll get another email once it&rsquo;s confirmed.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Requested date" value={formattedDate} />
        <EmailDetail label="Requested time" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/client/reservations`} accent="brand">
        View my reservations
      </EmailButton>
    </EmailLayout>
  );
}
