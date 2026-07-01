"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type State = { count: number; loaded: boolean };
type Action =
  | { type: "loaded"; count: number }
  | { type: "increment" }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  if (action.type === "reset") return { count: 0, loaded: true };
  if (action.type === "loaded") return { count: action.count, loaded: true };
  return { ...state, count: state.count + 1 };
}

export function useRealtimeBadge(
  table: string,
  resetOnPath: string,
  filterColumn?: string,
  filterValue?: string,
): number {
  const pathname = usePathname();
  const onPage =
    pathname === resetOnPath || pathname.startsWith(`${resetOnPath}/`);
  const [state, dispatch] = useReducer(reducer, { count: 0, loaded: false });
  const subscriptionId = useId().replace(/:/g, "");

  // Reset to 0 when navigating to the target page.
  useEffect(() => {
    if (onPage) dispatch({ type: "reset" });
  }, [onPage]);

  // Ref so the realtime callback can read the latest onPage without being a dep.
  const onPageRef = useRef(onPage);
  useEffect(() => {
    onPageRef.current = onPage;
  });

  // Fetch initial count + subscribe for inserts — stable dep, never recreated.
  useEffect(() => {
    const supabase = createClient();

    // Initial count query.
    let query = supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (filterColumn && filterValue) {
      query = query.eq(filterColumn, filterValue);
    }
    query.then(({ count }) => {
      // Only set the loaded count if we haven't already reset (i.e. not on the page).
      if (!onPageRef.current) {
        dispatch({ type: "loaded", count: count ?? 0 });
      }
    });

    // Realtime subscription for new inserts.
    const channel = supabase
      .channel(`badge:${table}:${subscriptionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table },
        () => {
          if (!onPageRef.current) dispatch({ type: "increment" });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filterColumn, filterValue, subscriptionId]); // stable — filterColumn/Value never change

  return onPage ? 0 : state.count;
}
