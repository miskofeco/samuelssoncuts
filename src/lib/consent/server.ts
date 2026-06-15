import { cookies } from "next/headers";

import {
  CONSENT_COOKIE,
  decodeConsent,
  needsConsent,
  type ConsentState,
} from "./config";

export type ConsentInit = {
  state: ConsentState | null;
  needs: boolean;
};

// Server-side consent resolution from the `cookie_consent` cookie. Returns plain
// serializable data (no functions) so it's safe to pass as a prop from the root
// layout into the client ConsentProvider — unlike the i18n dict, which holds
// interpolation functions and must be looked up client-side.
export async function getConsent(): Promise<ConsentInit> {
  const store = await cookies();
  const state = decodeConsent(store.get(CONSENT_COOKIE)?.value);
  return { state, needs: needsConsent(state) };
}
