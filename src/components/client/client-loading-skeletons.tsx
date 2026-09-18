import {
  LoadingPage,
  Skeleton,
  SkeletonCard,
  SkeletonSectionHeader,
  SkeletonStatGrid,
} from "@/components/shared/skeleton";

function ActivityRows({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="divide-y">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52 max-w-full" /></div>
          <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ClientOverviewSkeleton() {
  return (
    <LoadingPage>
      <SkeletonStatGrid />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <SkeletonCard className="min-h-56 bg-emerald-600/20">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-9 w-56 max-w-full" />
          <Skeleton className="mt-2 h-5 w-72 max-w-full" />
          <div className="mt-6 flex flex-col gap-2 sm:flex-row"><Skeleton className="h-11 w-full rounded-lg sm:w-32" /><Skeleton className="h-11 w-full rounded-lg sm:w-32" /></div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonSectionHeader />
          <div className="mt-4"><ActivityRows count={3} /></div>
        </SkeletonCard>
      </div>
    </LoadingPage>
  );
}

export function ClientBookingSkeleton() {
  return (
    <LoadingPage>
      <SkeletonCard className="-mx-4 rounded-none bg-transparent p-0 shadow-none ring-0 sm:mx-0 sm:rounded-xl sm:bg-card sm:p-5 sm:shadow-xs sm:ring-1">
        <div className="px-4 sm:px-0">
          <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-6 w-48" /></div></div>
        </div>
        <div className="mt-4 grid gap-3 px-4 sm:gap-2 sm:px-0 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex min-h-20 overflow-hidden rounded-xl ring-1 ring-foreground/10 sm:flex-col md:flex-row">
              <Skeleton className="h-20 w-20 shrink-0 rounded-none sm:h-36 sm:w-full md:h-auto md:min-h-32 md:w-32 lg:w-28" />
              <div className="flex min-w-0 flex-1 flex-col justify-center p-3"><Skeleton className="h-4 w-32 max-w-full" /><Skeleton className="mt-2 h-3 w-full" /><Skeleton className="mt-2 h-3 w-24" /></div>
            </div>
          ))}
        </div>
        <div className="mt-6 px-4 sm:px-0">
          <div className="flex items-center gap-3"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 w-36" /></div>
          <Skeleton className="mt-3 h-24 w-full rounded-lg" />
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 border-t px-4 pt-4 sm:px-0">
          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-44 max-w-full" /><Skeleton className="h-3 w-64 max-w-full" /></div>
          <Skeleton className="h-11 w-32 shrink-0 rounded-lg" />
        </div>
      </SkeletonCard>
    </LoadingPage>
  );
}

export function ClientNotificationsSkeleton() {
  return (
    <LoadingPage>
      <SkeletonCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><Skeleton className="size-11 shrink-0 rounded-xl" /><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64 max-w-full" /></div></div>
          <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonSectionHeader action />
        <div className="mt-4"><ActivityRows count={6} /></div>
      </SkeletonCard>
    </LoadingPage>
  );
}

export function ClientProfileSkeleton() {
  return (
    <LoadingPage>
      <div className="max-w-2xl space-y-4 sm:space-y-6">
        <SkeletonCard>
          <SkeletonSectionHeader eyebrow />
          <div className="mt-5 flex items-center gap-4"><Skeleton className="size-16 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-56 max-w-full" /><Skeleton className="h-8 w-24 rounded-lg" /></div></div>
          <div className="my-5 border-t" />
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}<Skeleton className="h-11 w-full rounded-lg sm:w-28" /></div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonSectionHeader description />
          <Skeleton className="mt-4 h-10 w-full rounded-lg sm:w-40" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonSectionHeader eyebrow />
          <div className="mt-4 divide-y">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:justify-between"><div className="flex gap-3"><Skeleton className="size-10 shrink-0 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-64 max-w-full" /></div></div><Skeleton className="h-10 w-full rounded-lg sm:w-28" /></div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </LoadingPage>
  );
}

function ReservationCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-start justify-between gap-3"><div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-28" /></div><Skeleton className="h-7 w-24 rounded-full" /></div>
      <Skeleton className="mt-4 h-16 w-full rounded-xl" />
      <div className="mt-3 flex justify-end"><Skeleton className="h-10 w-full rounded-lg sm:w-28" /></div>
    </SkeletonCard>
  );
}

export function ClientReservationsSkeleton() {
  return (
    <LoadingPage>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Skeleton className="h-10 w-full rounded-lg sm:w-36" /><Skeleton className="h-10 w-full rounded-lg sm:w-32" /></div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="space-y-3"><ReservationCardSkeleton /><ReservationCardSkeleton /><ReservationCardSkeleton /></div>
    </LoadingPage>
  );
}

export function ClientReservationDetailSkeleton() {
  return (
    <LoadingPage>
      <Skeleton className="h-10 w-36 rounded-lg" />
      <SkeletonCard>
        <div className="flex items-start gap-3"><Skeleton className="size-11 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><Skeleton className="h-6 w-48 max-w-[60%]" /><Skeleton className="h-7 w-24 rounded-full" /></div><Skeleton className="mt-2 h-4 w-44" /></div></div>
        <div className="mt-5 divide-y">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex items-center justify-between gap-4 py-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-40 max-w-[50%]" /></div>)}
        </div>
        <Skeleton className="mt-5 h-3 w-36" />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:flex"><Skeleton className="h-10 rounded-lg sm:w-32" /><Skeleton className="h-10 rounded-lg sm:w-32" /></div>
        <Skeleton className="mt-5 h-20 w-full rounded-lg" />
        <Skeleton className="mt-5 h-12 w-full rounded-lg" />
      </SkeletonCard>
    </LoadingPage>
  );
}
