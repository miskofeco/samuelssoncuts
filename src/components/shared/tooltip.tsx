"use client";

import type { ReactNode } from "react";

import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export { TooltipProvider };

/**
 * Hover/focus tooltip. The child must be a focusable element; on touch devices
 * the content should also be reachable another way (tooltips are supplementary).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <UiTooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} collisionPadding={8} className={className}>
        {content}
      </TooltipContent>
    </UiTooltip>
  );
}
