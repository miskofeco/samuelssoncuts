import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/classnames";

export type IconSource = IconSvgElement;

/**
 * Hugeicons wrapper with the app defaults: 16px box (override with a `size-*`
 * class), 1.8 stroke, decorative (`aria-hidden`) unless a label is passed.
 */
export function Icon({
  icon,
  className,
  strokeWidth = 1.8,
  "aria-label": ariaLabel,
  ...props
}: Omit<ComponentProps<typeof HugeiconsIcon>, "icon"> & { icon: IconSvgElement }) {
  return (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={strokeWidth}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      className={cn("size-4 shrink-0", className)}
      {...props}
    />
  );
}
