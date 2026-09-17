"use client";

import { Switch } from "@/components/ui/switch";

/**
 * Accessible on/off switch (Radix Switch: `role="switch"`, `aria-checked`,
 * Space/Enter toggling, form integration via `name`).
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
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      name={name}
      size={size === "sm" ? "sm" : "default"}
      className={className}
    />
  );
}
