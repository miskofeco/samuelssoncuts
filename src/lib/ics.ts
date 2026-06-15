// Minimal RFC 5545 iCalendar builder. Pure — no I/O — so it runs the same in
// API routes and tests.
//
// The whole point of exporting as .ics (rather than CSV/JSON) is DEDUP: every
// VEVENT carries a stable UID. Calendar apps (Google, Apple, Outlook, …) match
// imported events by UID — so re-importing an updated file UPDATES matched
// events in place and only ADDS genuinely new ones, never duplicating. The UID
// must therefore be derived from the appointment's database id and be identical
// across the one-off download and the live subscription feed.

export type IcsEvent = {
  /** Stable, globally-unique id — same value every export for this appointment. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
};

// Two-digit / four-digit zero pad for the UTC timestamp form.
function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

// RFC 5545 UTC date-time: YYYYMMDDTHHMMSSZ. Emitting in UTC keeps the absolute
// instant correct in any viewer's timezone.
function toIcsUtc(date: Date): string {
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

// Escape TEXT values per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline).
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fold lines to <=75 octets (UTF-8), continuation lines start with a space.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // Leave room: continuation lines are prefixed with a space (1 octet).
    const limit = out.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current) out.push(current);
  return out.join("\r\n ");
}

// Stable UID for an appointment — identical in the one-off download and the
// live feed, so calendar apps treat them as the same event (dedup on re-import).
export function appointmentUid(appointmentId: string): string {
  return `samuelsson-${appointmentId}@samuelsson-cuts`;
}

export function buildIcs(events: IcsEvent[], opts: { calName: string; prodId?: string }): string {
  const stamp = toIcsUtc(new Date());
  const prodId = opts.prodId ?? "-//Samuelsson Cuts//Scheduler//EN";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calName)}`,
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(event.start)}`,
      `DTEND:${toIcsUtc(event.end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
