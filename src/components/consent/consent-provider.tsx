"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { recordConsentAction } from "@/app/actions";
import {
  acceptAllState,
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE,
  encodeConsent,
  needsConsent,
  rejectAllState,
  stateFromChoices,
  type ConsentState,
} from "@/lib/consent/config";
import type { ConsentInit } from "@/lib/consent/server";

// The choices a user can toggle (Necessary is forced on).
export type OptionalChoices = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

type ConsentContextValue = {
  /** Stored decision, or null if the user hasn't decided yet. */
  state: ConsentState | null;
  /** True once a valid (current-version) decision exists. */
  isDecided: boolean;
  /** Banner visibility (shown until a decision is made). */
  bannerOpen: boolean;
  /** Preferences modal visibility. */
  modalOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  /** Save a specific set of optional choices. */
  save: (choices: OptionalChoices) => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

// Module-scope write keeps the document.cookie mutation out of the component body
// (React-Compiler lint disallows external mutations inside components) — mirrors
// persistLang in language-toggle.tsx.
function persistConsent(state: ConsentState) {
  document.cookie = `${CONSENT_COOKIE}=${encodeConsent(state)}; path=/; max-age=${CONSENT_COOKIE_MAX_AGE}; samesite=lax`;
}

// Mirror the decision to the DB audit log for signed-in users. Fire-and-forget:
// the cookie is authoritative, so a failed/anonymous write never blocks the UI.
function logConsent(state: ConsentState) {
  void recordConsentAction({
    functional: state.functional,
    analytics: state.analytics,
    marketing: state.marketing,
    version: state.version,
    timestamp: state.timestamp,
  }).catch(() => {
    // best-effort
  });
}

// `initial` is server-read plain data (no functions) — safe across the boundary.
export function ConsentProvider({
  initial,
  children,
}: {
  initial: ConsentInit;
  children: ReactNode;
}) {
  const [state, setState] = useState<ConsentState | null>(initial.state);
  const [modalOpen, setModalOpen] = useState(false);

  // Server can't read Date during render (and we want a stable value), so the
  // timestamp is stamped at click time inside the browser.
  const commit = useCallback((next: ConsentState) => {
    persistConsent(next);
    logConsent(next);
    setState(next);
    setModalOpen(false);
  }, []);

  const value = useMemo<ConsentContextValue>(() => {
    const isDecided = !needsConsent(state);
    return {
      state,
      isDecided,
      bannerOpen: !isDecided,
      modalOpen,
      openPreferences: () => setModalOpen(true),
      closePreferences: () => setModalOpen(false),
      acceptAll: () => commit(acceptAllState(new Date().toISOString())),
      rejectAll: () => commit(rejectAllState(new Date().toISOString())),
      save: (choices: OptionalChoices) =>
        commit(stateFromChoices(choices, new Date().toISOString())),
    };
  }, [state, modalOpen, commit]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return value;
}
