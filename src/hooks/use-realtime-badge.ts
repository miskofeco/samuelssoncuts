"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Tables whose changes affect the admin sidebar "needs attention" badges.
const WATCHED_TABLES = ["booking_requests", "profiles"] as const;

// Keep the admin sidebar badge counts fresh. The counts themselves are computed
// on the server (loadAttentionCounts) and passed down as props; they already
// update after the current admin's own actions because those server actions call
// revalidatePath("/admin", "layout").
//
// This hook covers the OTHER case: a booking request or profile changing in the
// background (a new request comes in, or another admin/device acts). It listens
// for Postgres changes on the relevant tables and calls router.refresh() to
// re-run the server components, which recomputes the counts. Refreshes are
// throttled so a burst of changes triggers at most one refresh per interval.
export function useAttentionRefresh() {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const MIN_INTERVAL_MS = 1500;

    function scheduleRefresh() {
      const now = Date.now();
      const elapsed = now - lastRefresh.current;
      if (elapsed >= MIN_INTERVAL_MS) {
        lastRefresh.current = now;
        router.refresh();
        return;
      }
      // Coalesce rapid changes into a single trailing refresh.
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        lastRefresh.current = Date.now();
        router.refresh();
      }, MIN_INTERVAL_MS - elapsed);
    }

    const channel = supabase.channel("admin-attention");
    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    return () => {
      if (pending.current) clearTimeout(pending.current);
      supabase.removeChannel(channel);
    };
  }, [router]);
}
