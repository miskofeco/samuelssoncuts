"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
};

// A small icon in a rounded chip with a hover/focus tooltip. The tooltip is a
// CSS-only popover (group-hover / focus-within) positioned relative to the chip,
// so it needs no portal and scales correctly inside the desktop-zoom layout
// (unlike fixed-position tooltips). The label is always exposed to assistive
// tech via aria-label + a visually-hidden span.
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
    <span className={cn("group/badge relative inline-flex", className)}>
      <span
        role="img"
        aria-label={label}
        tabIndex={0}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg outline-none ring-black/5 transition focus-visible:ring-2 dark:ring-white/10",
          tones[tone],
        )}
      >
        {icon}
      </span>
      {/* Anchored to the badge's left edge and opening rightward — these badges
          sit near the left screen edge, so a centered tooltip would overflow
          off-screen. max-w keeps it inside the narrow sidebar. */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-max max-w-[12rem] rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-left text-[0.7rem] font-medium leading-snug text-stone-700 shadow-lg group-focus-within/badge:block group-hover/badge:block dark:border-white/10 dark:bg-stone-800 dark:text-stone-200"
      >
        {label}
      </span>
    </span>
  );
}
