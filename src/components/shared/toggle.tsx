"use client";

import { Switch } from "radix-ui";

import { cn } from "@/lib/classnames";

/**
 * Accessible on/off switch (Radix Switch: `role="switch"`, `aria-checked`,
 * Space/Enter toggling, form integration via `name`). Black fill in light mode,
 * white in dark, matching the button language.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  name,
  size = "md",
  className,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible label for the switch (the visible label sits next to it). */
  label: string;
  name?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sm = size === "sm";
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      name={name}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-stone-900",
        sm ? "h-5 w-9" : "h-6 w-11",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-black dark:data-[state=checked]:bg-white",
        "data-[state=unchecked]:border-black/15 data-[state=unchecked]:bg-stone-200 dark:data-[state=unchecked]:border-white/15 dark:data-[state=unchecked]:bg-stone-700",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <Switch.Thumb
        className={cn(
          "block rounded-full bg-white shadow transition-transform dark:bg-stone-900",
          sm
            ? "size-4 data-[state=checked]:translate-x-[1.125rem] data-[state=unchecked]:translate-x-0.5"
            : "size-5 data-[state=checked]:translate-x-[1.375rem] data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </Switch.Root>
  );
}
