"use client";

import { ToggleGroup } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

type Option<T extends string> = {
  label: ReactNode;
  value: T;
  /** Optional trailing count badge. */
  count?: number;
};

/**
 * Single-select segmented control (Radix ToggleGroup): roving arrow-key focus,
 * `aria-pressed` state, and a value that can never be deselected.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={ariaLabel}
      className={cn(
        "grid rounded-lg border border-black/10 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-stone-900",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset dark:focus-visible:ring-white",
            size === "sm" ? "min-h-8 px-3 text-xs" : "min-h-10 px-4 text-sm",
            "data-[state=on]:bg-black data-[state=on]:text-white dark:data-[state=on]:bg-white dark:data-[state=on]:text-black",
            "data-[state=off]:text-stone-600 data-[state=off]:hover:bg-stone-100 dark:data-[state=off]:text-stone-300 dark:data-[state=off]:hover:bg-stone-800",
          )}
        >
          <span className="truncate">{option.label}</span>
          {option.count ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[0.65rem] tabular-nums data-[state=off]:bg-stone-100 dark:bg-black/10">
              {option.count > 99 ? "99+" : option.count}
            </span>
          ) : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
