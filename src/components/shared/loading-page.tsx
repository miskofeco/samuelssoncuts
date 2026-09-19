import type { ReactNode } from "react";

import { getDict } from "@/i18n/server";
import { cn } from "@/lib/classnames";

/**
 * Accessible page-level loading region shared by route-specific skeletons.
 * Server-only (reads the language cookie); used from `loading.tsx` trees.
 */
export async function LoadingPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const t = await getDict();
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-label={t.common.loading}
      aria-live="polite"
      aria-busy="true"
    >
      {children}
    </div>
  );
}
