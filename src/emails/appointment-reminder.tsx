// Sent ~24 hours before a confirmed appointment.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { getSiteUrl } from "@/lib/env";

export function AppointmentReminderEmail({
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
  return (
    <EmailLayout preview={`Reminder: your appointment tomorrow at ${time}`}>
      <EmailHeading>Appointment reminder</EmailHeading>
      <EmailParagraph>Hi {clientName},</EmailParagraph>
      <EmailParagraph>
        Just a reminder that you have an appointment coming up tomorrow.
      </EmailParagraph>
      <EmailDetails>
        <EmailDetail label="Service" value={service} />
        <EmailDetail label="Date" value={date} />
        <EmailDetail label="Time" value={time} />
      </EmailDetails>
      <EmailButton href={`${getSiteUrl()}/client/reservations`}>
        View my appointments
      </EmailButton>
    </EmailLayout>
  );
}
