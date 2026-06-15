// Bilingual config. The chosen language lives in a cookie (read on the server
// per-request) so Server Components render in the right language with no flash.
export type Lang = "sk" | "en";

export const LANGS: Lang[] = ["sk", "en"];

// New visitors see Slovak first (the shop's primary audience).
export const DEFAULT_LANG: Lang = "sk";

export const LANG_COOKIE = "lang";
// One year — the toggle re-sets it on every change.
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLang(value: unknown): value is Lang {
  return value === "sk" || value === "en";
}

// BCP-47 locale for Intl date/number formatting.
export function localeFor(lang: Lang): string {
  return lang === "sk" ? "sk-SK" : "en-US";
}
