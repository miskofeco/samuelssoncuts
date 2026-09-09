import { cn } from "@/lib/classnames";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("ss-skeleton rounded-md", className)} />;
}

/** Standard page-level skeleton: header + N cards. Used by route loading.tsx files. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="space-y-3 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-stone-900"
          >
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
