"use client";

import { Alert02Icon, HelpCircleIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Icon } from "@/components/shared/icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl bg-card text-card-foreground sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia
            className={cn(
              "rounded-xl",
              destructive ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
            )}
          >
            <Icon icon={destructive ? Alert02Icon : HelpCircleIcon} className="size-5" strokeWidth={2} />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-lg font-semibold">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children ? <div className="text-left">{children}</div> : null}
        <AlertDialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          <AlertDialogCancel disabled={loading}>{cancelLabel ?? t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={loading}
            aria-busy={loading || undefined}
            onClick={(event) => {
              // Keep the dialog open while the action runs; the caller closes
              // it via onOpenChange when done.
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
