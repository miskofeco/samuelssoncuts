import type { ComponentProps, ReactNode } from "react";

import { Skeleton as UiSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/classnames";

export function Skeleton({ className, ...props }: ComponentProps<typeof UiSkeleton>) {
  return <UiSkeleton {...props} aria-hidden className={cn("ss-skeleton animate-none", className)} />;
}

/** Accessible page-level loading region shared by route-specific skeletons. */
export function LoadingPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-label="Loading"
      aria-live="polite"
      aria-busy="true"
    >
      {children}
    </div>
  );
}

/** Matches the app's padded Card surface without importing interactive card UI. */
export function SkeletonCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SkeletonSectionHeader({
  action = false,
  description = false,
  eyebrow = false,
}: {
  action?: boolean;
  description?: boolean;
  eyebrow?: boolean;
}) {
  return (
    <div aria-hidden className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        {eyebrow ? <Skeleton className="h-3 w-24" /> : null}
        <Skeleton className="h-6 w-48 max-w-full" />
        {description ? <Skeleton className="h-4 w-80 max-w-full" /> : null}
      </div>
      {action ? <Skeleton className="h-8 w-28 shrink-0 rounded-full" /> : null}
    </div>
  );
}

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} className="p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="size-9 rounded-lg sm:size-10" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-8 w-16 sm:mt-4" />
          <Skeleton className="mt-2 h-3.5 w-24 max-w-full" />
          <Skeleton className="mt-2 hidden h-3 w-32 max-w-full sm:block" />
        </SkeletonCard>
      ))}
    </div>
  );
}
