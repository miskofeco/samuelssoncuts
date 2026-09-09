"use client";

import { useT } from "@/i18n/provider";

/** Localized fallback for success results without a message (client-only hook). */
export function LocalizedDone() {
  const t = useT();
  return <>{t.common.done}</>;
}
