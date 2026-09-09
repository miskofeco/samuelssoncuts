"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

/**
 * Side drawer (navigation, filters) built on Radix Dialog so it gets the same
 * focus trap, scroll lock, Escape handling and `aria-modal` semantics as Modal.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = "left",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name; visually hidden. */
  title: string;
  children: ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  const t = useT();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ss-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "ss-drawer fixed inset-y-0 z-50 flex h-full w-[82%] max-w-xs flex-col bg-white shadow-2xl outline-none dark:bg-stone-900",
            side === "left" ? "left-0" : "ss-drawer-right right-0",
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <Dialog.Close
            aria-label={t.common.close}
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-black dark:hover:bg-stone-800 dark:hover:text-white"
          >
            <X className="size-[18px]" aria-hidden />
          </Dialog.Close>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
