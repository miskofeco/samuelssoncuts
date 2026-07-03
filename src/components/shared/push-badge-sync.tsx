"use client";

import { useEffect } from "react";

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

export function PushBadgeSync({ badgeCount }: { badgeCount: number }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (cancelled) return;
      registration.active?.postMessage({ type: "SET_BADGE", count: badgeCount });
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
