// Sent to the barber when a client accepts or declines a proposed time.
import { EmailButton, EmailDetail, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function ClientRespondedEmail({
  clientName,
  service,
  date,
  time,
  accepted,
}: {
  clientName: string;
  service: string;
  date: string;
  time: string;
  accepted: boolean;
}) {
  return (
    <EmailLayout
      preview={
        accepted
          ? `${clientName} confirmed the appointment`
          : `${clientName} declined the proposed time`
      }
    >
      <EmailHeading>
        {accepted ? "Appointment confirmed by client" : "Client declined proposed time"}
      </EmailHeading>
      <EmailParagraph>
        <strong>{clientName}</strong> has{" "}
        {accepted ? "accepted" : "declined"} the proposed appointment.
      </EmailParagraph>
      <EmailDetail label="Service" value={service} />
      <EmailDetail label="Date" value={date} />
      <EmailDetail label="Time" value={time} />
      <EmailButton href={`${getSiteUrl()}/admin/calendar`}>
        View calendar
      </EmailButton>
    </EmailLayout>
  );
}
