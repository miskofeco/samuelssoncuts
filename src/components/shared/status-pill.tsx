import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/classnames";

export type PillTone = "neutral" | "success" | "warning" | "info" | "danger";

export const pillTones: Record<PillTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  info: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
};

const dotTones: Record<PillTone, string> = {
  neutral: "bg-muted-foreground/60",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  danger: "bg-destructive",
};

/** Small status label. Semantic colour comes from `tone`; `dot` adds a marker. */
export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("h-6 gap-1.5 rounded-full px-2.5 text-xs font-semibold", pillTones[tone], className)}
    >
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", dotTones[tone])} /> : null}
      {children}
    </Badge>
  );
}
