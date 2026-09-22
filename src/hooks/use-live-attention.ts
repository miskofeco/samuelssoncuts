"use client";

import { useEffect, useState } from "react";

import type { NavCounts } from "@/components/layout/nav-items";

export const ATTENTION_COUNTS_EVENT = "admin-attention-counts";

export function useLiveAttention(initialCounts: NavCounts): NavCounts {
  const [state, setState] = useState({ initialCounts, current: initialCounts });

  // Server actions re-render the shell with authoritative counts. Reset the
  // realtime overlay during render so navigation never shows stale badges.
  if (state.initialCounts !== initialCounts) {
    setState({ initialCounts, current: initialCounts });
  }

  useEffect(() => {
    function onCounts(event: Event) {
      const counts = (event as CustomEvent<{ requests: number; approvals: number }>).detail;
      if (!Number.isSafeInteger(counts?.requests) || !Number.isSafeInteger(counts?.approvals)) return;
      setState((previous) => ({
        ...previous,
        current: { ...previous.current, requests: counts.requests, approvals: counts.approvals },
      }));
    }
    window.addEventListener(ATTENTION_COUNTS_EVENT, onCounts);
    return () => window.removeEventListener(ATTENTION_COUNTS_EVENT, onCounts);
  }, []);

  return state.initialCounts === initialCounts ? state.current : initialCounts;
}
