"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/shared/button";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

/**
 * Blocking confirmation for destructive actions (cancel, decline, delete).
 * Built on Radix AlertDialog: no outside-click dismissal, focus lands on the
 * cancel button so a stray Enter never confirms.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  loading = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  /** Optional extra fields (e.g. a reason textarea) rendered above the actions. */
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="ss-overlay fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-0 sm:items-center sm:p-4">
          <AlertDialog.Content className="ss-modal-panel pointer-events-auto w-full rounded-t-2xl border border-black/10 bg-white p-5 shadow-2xl outline-none dark:border-white/10 dark:bg-stone-900 sm:max-w-md sm:rounded-2xl">
            <AlertDialog.Title className="text-lg font-semibold text-black dark:text-white">
              {title}
            </AlertDialog.Title>
            {description ? (
              <AlertDialog.Description className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                {description}
              </AlertDialog.Description>
            ) : null}
            {children ? <div className="mt-4">{children}</div> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 pb-[max(0px,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              <AlertDialog.Cancel className={cn(buttonVariants({ variant: "secondary" }))} disabled={loading}>
                {cancelLabel ?? t.common.cancel}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={cn(buttonVariants({ variant: destructive ? "danger" : "primary" }))}
                disabled={loading}
                aria-busy={loading || undefined}
                onClick={(event) => {
                  // Keep the dialog open while the action runs; the caller
                  // closes it via onOpenChange when done.
                  event.preventDefault();
                  onConfirm();
                }}
              >
                {confirmLabel}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
