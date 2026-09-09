"use client";

import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>;
}

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
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "ss-popover z-[70] max-w-xs rounded-lg border border-black/10 bg-stone-950 px-3 py-2 text-xs font-medium text-white shadow-lg dark:border-white/10 dark:bg-white dark:text-black",
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-stone-950 dark:fill-white" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
