// Daily "your day" digest sent to the barber each morning alongside the client
// reminders (same 08:00 cron). Lists today's confirmed appointments.
import { EmailButton, EmailDetail, EmailDetails, EmailHeading, EmailLayout, EmailParagraph } from "./layout";
import { formatEmailDate } from "./date";
import { getSiteUrl } from "@/lib/env";

export type AgendaItem = {
  time: string;
  service: string;
  customer: string;
};

export function BarberAgendaEmail({
  date,
  items,
}: {
  date: string;
  items: AgendaItem[];
}) {
  const formattedDate = formatEmailDate(date);
  const count = items.length;
  const termText = count === 1 ? "termín" : count > 1 && count < 5 ? "termíny" : "termínov";
  const confirmedText = count === 1 ? "potvrdený" : "potvrdené";

  return (
    <EmailLayout preview={`Dnes: ${count} ${termText}`} accent="brand">
      <EmailHeading icon="calendar">Dnešný prehľad</EmailHeading>
      <EmailParagraph>
        {formattedDate} - máte {count} {confirmedText} {termText}.
      </EmailParagraph>
      {count > 0 ? (
        <EmailDetails>
          {items.map((item, index) => (
            <EmailDetail
              key={index}
              label={item.time}
              value={`${item.service} · ${item.customer}`}
              icon="clock"
            />
          ))}
        </EmailDetails>
      ) : (
        <EmailParagraph>Na dnes nie sú rezervované žiadne termíny.</EmailParagraph>
      )}
      <EmailButton href={`${getSiteUrl()}/admin/calendar`} accent="brand">
        Otvoriť kalendár
      </EmailButton>
    </EmailLayout>
  );
}
