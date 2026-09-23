"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Keep an already-rendered picker current without replacing its form state. */
export function useLiveSnapshot<T>(initial: T, url: string, intervalMs: number) {
  const [remote, setRemote] = useState<{ url: string; initial: T; data: T } | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let active = true;
    let busy = false;
    let queued = false;
    let controller: AbortController | null = null;

    async function fetchSnapshot() {
      if (!active || document.visibilityState === "hidden") return;
      if (busy) {
        queued = true;
        return;
      }
      busy = true;
      controller = new AbortController();
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as T;
        if (active) setRemote({ url, initial, data });
      } catch {
        // A failed background read must not interrupt a booking in progress.
      } finally {
        busy = false;
        controller = null;
        if (queued && active) {
          queued = false;
          void fetchSnapshot();
        }
      }
    }

    const requestRefresh = () => { void fetchSnapshot(); };
    refreshRef.current = requestRefresh;
    const timer = window.setInterval(requestRefresh, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") requestRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", requestRefresh);
    window.addEventListener("focus", requestRefresh);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", requestRefresh);
      window.removeEventListener("focus", requestRefresh);
      refreshRef.current = () => {};
    };
  }, [initial, intervalMs, url]);

  return { data: remote?.url === url && remote.initial === initial ? remote.data : initial, refresh };
}
