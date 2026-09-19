// Upstream messages (PostgREST, Resend, GoTrue) can quote the offending row,
// which may contain an email address or phone number. Strip those before a
// record reaches stdout or the error webhook so logs never carry personal data.
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}\d/g;

export function redact(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[email]")
    // Dates and short ids share the character class; only 9+ digit runs are
    // treated as phone numbers.
    .replace(PHONE_PATTERN, (match) => (match.replace(/\D/g, "").length >= 9 ? "[phone]" : match));
}
