"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Config describing which rows count as "open / needs attention".
export type OpenCountConfig = {
  table: string;
  // Equality filters applied to the count query, e.g. { status: "pending" }.
  match: Record<string, string>;
  // Optional "column IS NOT NULL" requirement, e.g. only email-confirmed
  // profiles count as an actionable approval.
  notNull?: string;
};

// Live count of currently-open rows for a sidebar badge. Unlike a "new since
// last visit" counter, this always reflects the true number of open items: it
// runs an exact COUNT and re-runs it on ANY change to the table (insert,
// update, or delete), so the badge goes UP when work arrives and DOWN the
// moment the admin confirms/approves it. The sidebar hides the badge at 0.
export function useOpenCount(config: OpenCountConfig): number {
  const [count, setCount] = useState(0);
  // Unique per mount so the desktop sidebar and the mobile drawer (both
  // rendered simultaneously) don't collide on one realtime channel name.
  const subscriptionId = useId().replace(/:/g, "");
  // Stable primitive dep — the config object is recreated each render.
  const configKey = JSON.stringify(config);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function refresh() {
      let query = supabase.from(config.table).select("*", { count: "exact", head: true });
      for (const [column, value] of Object.entries(config.match)) {
        query = query.eq(column, value);
      }
      if (config.notNull) {
        query = query.not(config.notNull, "is", null);
      }
      const { count: next } = await query;
      if (!cancelled) setCount(next ?? 0);
    }

    refresh();

    // Subscribe to every change on the table and re-count. A status UPDATE that
    // moves a row out of the "open" set would not match a value-scoped filter
    // (Postgres CDC filters match the changed row), so we intentionally listen
    // broadly and let the exact re-count stay authoritative. Table volume here
    // (requests, profiles) is low, so this is cheap.
    const channel = supabase
      .channel(`open-count:${config.table}:${subscriptionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: config.table },
        () => {
          if (!cancelled) refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // configKey (a stable JSON string) stands in for the config object's
    // contents, which are recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, subscriptionId]);

  return count;
}
