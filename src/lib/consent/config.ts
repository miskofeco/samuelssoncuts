// Cookie-consent config. The chosen preferences live in a cookie (read on the
// server per-request, written on the client) so Server Components and the banner
// agree with no flash — the same approach as the `lang` cookie in src/i18n.
//
// Pure module: no React, no next/headers — safe to import from both server and
// client code.

export type ConsentCategory =
  | "necessary"
  | "functional"
  | "analytics"
  | "marketing";

// The non-essential categories the user can toggle. `necessary` is always on.
export const OPTIONAL_CATEGORIES: Exclude<ConsentCategory, "necessary">[] = [
  "functional",
  "analytics",
  "marketing",
];

export const ALL_CATEGORIES: ConsentCategory[] = [
  "necessary",
  ...OPTIONAL_CATEGORIES,
];

export type ConsentState = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  // Schema version of the consent text the user agreed to. Bumping
  // CONSENT_VERSION re-prompts everyone (their stored version no longer matches).
  version: number;
  // ISO timestamp of when the choice was made (proof-of-consent record).
  timestamp: string;
};

export const CONSENT_COOKIE = "cookie_consent";

// Bump when the cookie policy or categories materially change — forces a re-ask.
export const CONSENT_VERSION = 1;

// 6 months. Past this the cookie expires and the banner re-appears, which is the
// commonly-accepted maximum lifetime for a consent record under EU guidance.
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

// Date the policy text was last revised — shown on the banner/modal/policy page.
export const CONSENT_LAST_UPDATED = "2026-06-15";

// All optional categories granted.
export function acceptAllState(timestamp: string): ConsentState {
  return {
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
    version: CONSENT_VERSION,
    timestamp,
  };
}

// Only the strictly-necessary cookies — everything optional refused.
export function rejectAllState(timestamp: string): ConsentState {
  return {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    version: CONSENT_VERSION,
    timestamp,
  };
}

// Build a full state from a partial set of optional choices (necessary forced on,
// version/timestamp stamped by the caller).
export function stateFromChoices(
  choices: { functional: boolean; analytics: boolean; marketing: boolean },
  timestamp: string,
): ConsentState {
  return {
    necessary: true,
    functional: choices.functional,
    analytics: choices.analytics,
    marketing: choices.marketing,
    version: CONSENT_VERSION,
    timestamp,
  };
}

export function encodeConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

// Defensive parse: any malformed/legacy value decodes to null (→ re-prompt),
// never throws.
export function decodeConsent(value: string | undefined): ConsentState | null {
  if (!value) return null;
  try {
    const raw: unknown = JSON.parse(decodeURIComponent(value));
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (
      typeof o.functional !== "boolean" ||
      typeof o.analytics !== "boolean" ||
      typeof o.marketing !== "boolean" ||
      typeof o.version !== "number"
    ) {
      return null;
    }
    return {
      necessary: true,
      functional: o.functional,
      analytics: o.analytics,
      marketing: o.marketing,
      version: o.version,
      timestamp: typeof o.timestamp === "string" ? o.timestamp : "",
    };
  } catch {
    return null;
  }
}

// True when we must show the banner: no decision yet, or the stored decision was
// made against an older policy version.
export function needsConsent(state: ConsentState | null): boolean {
  return !state || state.version !== CONSENT_VERSION;
}
