"use client";

import type { ReactNode } from "react";

import { Tooltip } from "@/components/shared/tooltip";
import { cn } from "@/lib/classnames";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  info: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
};

/**
 * Small icon chip with a tooltip. The label is always exposed to assistive tech
 * through `aria-label`; the tooltip is a visual aid for hover/focus.
 */
export function IconBadge({
  icon,
  label,
  tone = "neutral",
  className,
}: {
  icon: ReactNode;
  /** Tooltip text and accessible name. */
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Tooltip content={label} side="top">
      <span
        role="img"
        aria-label={label}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-lg outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
          tones[tone],
          className,
        )}
      >
        {icon}
      </span>
    </Tooltip>
  );
}
