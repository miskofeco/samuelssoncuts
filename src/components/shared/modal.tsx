"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

type ModalSize = "sm" | "md" | "lg" | "xl";

const sizeClass: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

/**
 * Accessible dialog built on Radix Dialog: portal, focus trap, focus return,
 * Escape/outside dismissal, scroll lock (iOS-safe), `aria-hidden` on the rest
 * of the page, and exit animations via `data-state`. Renders as a bottom sheet
 * on phones and a centred panel from `sm` up.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Sticky action row rendered below the scrollable body. */
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
}) {
  const t = useT();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="ss-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-0 sm:items-center sm:p-4 pointer-events-none">
          <Dialog.Content
            className={cn(
              "ss-modal-panel pointer-events-auto relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-black/10 bg-white shadow-2xl outline-none dark:border-white/10 dark:bg-stone-900 sm:max-h-[min(90vh,calc(100dvh-2rem))] sm:rounded-2xl",
              sizeClass[size],
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 pt-5 pb-3 dark:border-white/10">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold text-black dark:text-white">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                    {description}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
              <Dialog.Close
                aria-label={t.common.close}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-black dark:hover:bg-stone-800 dark:hover:text-white"
              >
                <X className="size-[18px]" aria-hidden />
              </Dialog.Close>
            </div>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-5 pt-4",
                footer ? "pb-4" : "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
              )}
            >
              {children}
            </div>
            {footer ? (
              <div className="flex flex-col-reverse gap-2 border-t border-black/10 bg-white/95 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:justify-end dark:border-white/10 dark:bg-stone-900/95">
                {footer}
              </div>
            ) : null}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
