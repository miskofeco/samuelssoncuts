"use client";

import { useEffect } from "react";
import type { NavCounts } from "@/components/layout/nav-items";
import { useLiveAttention } from "@/hooks/use-live-attention";

declare global {
  interface Navigator {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  }
}

function canUseBadges(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "setAppBadge" in navigator &&
    "clearAppBadge" in navigator
  );
}

async function setBadge(count: number) {
  if (!canUseBadges()) return;
  const value = Math.max(0, count);

  if (value > 0) {
    await navigator.setAppBadge?.(value);
  } else {
    await navigator.clearAppBadge?.();
  }
}

export function PushBadgeSync({ counts, role }: { counts: NavCounts; role: "admin" | "client" }) {
  const liveCounts = useLiveAttention(counts);
  const badgeCount = role === "admin"
    ? liveCounts.requests + liveCounts.approvals
    : liveCounts.unread;

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js")
      .catch(() => {
        // Service worker support can be disabled by browser/device policy.
      });
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    // `ready` waits for the active worker even on the first registration.
    navigator.serviceWorker.ready.then((registration) => {
      if (!cancelled) registration.active?.postMessage({ type: "SET_BADGE", count: badgeCount });
    }).catch(() => {
      // Service worker support can be disabled by browser/device policy.
    });
    return () => {
      cancelled = true;
    };
  }, [badgeCount]);

  useEffect(() => {
    setBadge(badgeCount).catch(() => {
      // Badging is best-effort and unavailable in some browsers.
    });
  }, [badgeCount]);

  return null;
}
