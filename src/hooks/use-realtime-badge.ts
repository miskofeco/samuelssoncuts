"use client";

import { useEffect, useId, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ATTENTION_COUNTS_EVENT } from "@/hooks/use-live-attention";

// Tables whose changes affect the admin sidebar "needs attention" badges.
const WATCHED_TABLES = ["booking_requests", "profiles"] as const;

// Background changes update just the navigation counts. Refreshing the whole
// route here would re-run expensive calendar/analytics loaders and disturb an
// admin mid-edit. Server actions still revalidate their affected pages.
export function useAttentionRefresh() {
  const channelId = useId();
  const channelName = `admin-attention-${channelId.replaceAll(":", "")}`;
  const lastRefresh = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const MIN_INTERVAL_MS = 1500;
    let controller: AbortController | null = null;

    async function refreshCounts() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/admin/attention", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const counts = await response.json();
        window.dispatchEvent(new CustomEvent(ATTENTION_COUNTS_EVENT, { detail: counts }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    function scheduleRefresh() {
      const now = Date.now();
      const elapsed = now - lastRefresh.current;
      if (elapsed >= MIN_INTERVAL_MS) {
        lastRefresh.current = now;
        void refreshCounts();
        return;
      }
      // Coalesce rapid changes into a single trailing refresh.
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        lastRefresh.current = Date.now();
        void refreshCounts();
      }, MIN_INTERVAL_MS - elapsed);
    }

    const channel = supabase.channel(channelName);
    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    function onVisibility() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", scheduleRefresh);

    return () => {
      if (pending.current) clearTimeout(pending.current);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", scheduleRefresh);
      supabase.removeChannel(channel);
    };
  }, [channelName]);
}
