"use client";

import { useEffect, useState } from "react";
import type { AnimationEvent, ReactNode } from "react";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

const EXIT_ANIMATION_MS = 320;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(open);

  if (open && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (open || !mounted) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => {
      setMounted(false);
    }, prefersReducedMotion ? 0 : EXIT_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (event: KeyboardEvent) => {
      if (open && event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mounted, onClose, open]);

  if (!mounted) return null;

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (!open && event.currentTarget === event.target) {
      setMounted(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className={cn(
          open ? "ss-overlay-in" : "ss-overlay-out",
          "absolute inset-0 bg-black/40 backdrop-blur-sm",
        )}
        onClick={open ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onAnimationEnd={handleAnimationEnd}
        className={cn(
          open ? "ss-modal-panel-in" : "ss-modal-panel-out",
          "ss-modal-panel relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-stone-900 sm:max-w-lg sm:rounded-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-black dark:text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
