"use client";

import { useEffect, useReducer, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Action = { type: "increment" } | { type: "reset" };

function reducer(count: number, action: Action) {
  if (action.type === "reset") return 0;
  return count + 1;
}

export function useRealtimeBadge(table: string, resetOnPath: string): number {
  const pathname = usePathname();
  const onPage = pathname === resetOnPath || pathname.startsWith(`${resetOnPath}/`);

  const [count, dispatch] = useReducer(reducer, 0);

  // Reset when landing on the target page.
  useEffect(() => {
    if (onPage) dispatch({ type: "reset" });
  }, [onPage]);

  // Subscribe once per table — stable dep, never recreated on navigation.
  // Use a ref so the callback can read the latest `onPage` without being
  // listed as a dep (which would cause the subscribe/unsubscribe cycle that
  // triggers the Supabase "cannot add callbacks after subscribe()" error).
  const onPageRef = useRef(onPage);
  useEffect(() => {
    onPageRef.current = onPage;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`badge:${table}`)
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
  }, [table]); // stable — never triggers re-subscribe

  return onPage ? 0 : count;
}
