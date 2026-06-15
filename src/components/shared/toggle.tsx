"use client";

import { cn } from "@/lib/classnames";

// Accessible on/off switch. Styled to match the segmented-control / button
// language (black fill in light mode, white in dark). When `disabled` it renders
// as a fixed "on" pill (used for the always-on Necessary category).
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
  className,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible label for the switch (the visible label sits next to it). */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={disabled ? undefined : () => onChange?.(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:focus:ring-white dark:focus:ring-offset-stone-900",
        sm ? "h-5 w-9" : "h-6 w-11",
        checked
          ? "border-transparent bg-black dark:bg-white"
          : "border-black/15 bg-stone-200 dark:border-white/15 dark:bg-stone-700",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block transform rounded-full bg-white shadow transition dark:bg-stone-900",
          sm ? "h-4 w-4" : "h-5 w-5",
          sm
            ? checked
              ? "translate-x-[1.125rem]"
              : "translate-x-0.5"
            : checked
              ? "translate-x-[1.375rem]"
              : "translate-x-0.5",
        )}
      />
    </button>
  );
}
