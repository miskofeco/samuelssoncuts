"use client";

import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/classnames";

type Option<T extends string> = {
  label: ReactNode;
  value: T;
  /** Optional trailing count badge. */
  count?: number;
};

/**
 * Single-select segmented control (Radix ToggleGroup): roving arrow-key focus,
 * `data-state` styling, and a value that can never be deselected. Stretches to
 * the container width so every segment is a comfortable tap target.
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
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={ariaLabel}
      spacing={1}
      className={cn("grid w-full rounded-xl bg-muted p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={cn(
            "min-w-0 rounded-lg font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs data-[state=on]:ring-1 data-[state=on]:ring-foreground/10",
            size === "sm" ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
          )}
        >
          <span className="truncate">{option.label}</span>
          {option.count ? (
            <span className="rounded-full bg-foreground/8 px-1.5 text-[0.65rem] tabular-nums">
              {option.count > 99 ? "99+" : option.count}
            </span>
          ) : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
