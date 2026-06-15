"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import type { Lang } from "./config";
import { dictionaries, type Dict } from "./dictionaries";

type LanguageValue = { lang: Lang; dict: Dict };

const LanguageContext = createContext<LanguageValue | null>(null);

// The root layout reads the cookie on the server and passes only the `lang`
// string here (a plain serializable value). The provider looks up the dictionary
// on the client, so the dict — which contains interpolation FUNCTIONS — never
// has to cross the server→client boundary (functions aren't serializable).
export function LanguageProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: ReactNode;
}) {
  const value = useMemo<LanguageValue>(
    () => ({ lang, dict: dictionaries[lang] }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return value;
}

/** The active dictionary for client components. */
export function useT(): Dict {
  return useLanguage().dict;
}

/** The active language code. */
export function useLang(): Lang {
  return useLanguage().lang;
}
