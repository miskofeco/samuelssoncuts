"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import {
  Sheet as UiSheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

/**
 * Side drawer (navigation, filters) built on the shadcn Sheet (Radix Dialog),
 * so it gets a focus trap, scroll lock, Escape handling and `aria-modal`.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "left",
  showTitle = false,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name; visually hidden. */
  title: string;
  description?: string;
  children: ReactNode;
  side?: "left" | "right" | "bottom";
  /** Render the title as a visible header row (with the close button inline). */
  showTitle?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <UiSheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn(
          "gap-0 bg-card p-0 text-card-foreground",
          side === "bottom"
            ? "max-h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)] rounded-t-2xl"
            : "w-[86%] max-w-xs",
          className,
        )}
      >
        {showTitle ? (
          <div className="flex items-center justify-between gap-3 border-b px-4 pt-3 pb-3">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base font-semibold">{title}</SheetTitle>
              <SheetDescription className="sr-only">{description ?? title}</SheetDescription>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label={t.common.close} className="-mr-2 shrink-0">
                <Icon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </SheetClose>
          </div>
        ) : (
          <>
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <SheetDescription className="sr-only">{description ?? title}</SheetDescription>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.common.close}
                className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10"
              >
                <Icon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            </SheetClose>
          </>
        )}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            side === "bottom" || showTitle ? "pt-4" : "pt-[max(1rem,env(safe-area-inset-top))]",
          )}
        >
          {children}
        </div>
      </SheetContent>
    </UiSheet>
  );
}
