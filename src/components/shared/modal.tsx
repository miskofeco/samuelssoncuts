"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

type ModalSize = "sm" | "md" | "lg" | "xl";

const sizeClass: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Sticky action row rendered below the scrollable body. */
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
};

/**
 * Responsive modal. Phones get a swipeable bottom drawer (vaul) with a drag
 * handle; larger screens get a centred Radix dialog. Both share the same
 * anatomy: fixed header, scrollable body, sticky footer, safe-area padding.
 */
export function Modal(props: ModalProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileModal {...props} /> : <DesktopModal {...props} />;
}

function MobileModal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const t = useT();
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      repositionInputs={false}
    >
      <DrawerContent
        className={cn(
          "max-h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)] rounded-t-2xl bg-card text-card-foreground",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-2 pb-3">
          <div className="min-w-0">
            <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="mt-1">{description}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">{title}</DrawerDescription>
            )}
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t.common.close} className="-mr-1 shrink-0">
              <Icon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </DrawerClose>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1",
            footer ? "pb-4" : "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t bg-card/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur *:w-full">
            {footer}
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function DesktopModal({ open, onClose, title, description, children, footer, size = "md", className }: ModalProps) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(90vh,calc(100dvh-2rem))] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 text-card-foreground",
          sizeClass[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 pt-5 pb-4">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="mt-1">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t.common.close} className="-mr-1 shrink-0">
              <Icon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </DialogClose>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pt-4", footer ? "pb-4" : "pb-5")}>{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
