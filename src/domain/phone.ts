// Phone numbers are a login-adjacent identity in this app: every client must
// have a unique one before the barber can approve them. Users type them in many
// shapes ("+421 900 123 456", "0900-123-456", "00421900123456"), so every write
// path canonicalises first and uniqueness is checked on the canonical form.

const SEPARATORS = /[\s\-().]/g;

/** Canonical form: digits only, optional leading "+", "00" prefix folded to "+". */
export function normalizePhone(raw: string): string {
  const stripped = raw.trim().replace(SEPARATORS, "");
  return stripped.startsWith("00") ? `+${stripped.slice(2)}` : stripped;
}

/** True for a normalised number with 7–15 digits and at most one leading "+". */
export function isValidPhone(normalized: string): boolean {
  return /^\+?\d{7,15}$/.test(normalized);
}

/** Normalise and validate in one step; `null` when the input is not a usable number. */
export function parsePhone(raw: string): string | null {
  const normalized = normalizePhone(raw);
  return isValidPhone(normalized) ? normalized : null;
}
