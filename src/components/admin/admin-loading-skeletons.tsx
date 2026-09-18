import {
  LoadingPage,
  Skeleton,
  SkeletonCard,
  SkeletonSectionHeader,
  SkeletonStatGrid,
} from "@/components/shared/skeleton";

function ListRows({ count = 3, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <div aria-hidden className="divide-y">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          {avatar ? <Skeleton className="size-10 shrink-0 rounded-xl" /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36 max-w-[70%]" />
            <Skeleton className="h-3 w-52 max-w-[90%]" />
          </div>
          <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <SkeletonCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <div className={tall ? "h-72" : "h-56"}>
        <div className="flex h-full items-end gap-2 border-b border-l px-3 pb-3">
          {[42, 68, 54, 82, 62, 91, 73, 58, 79, 66].map((height, index) => (
            <Skeleton key={index} className="min-w-0 flex-1 rounded-t-md" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <LoadingPage>
      <SkeletonCard className="space-y-4">
        <SkeletonSectionHeader action description />
        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="h-32 min-w-[18rem] flex-1 rounded-xl" />
          <Skeleton className="hidden h-32 min-w-[18rem] flex-1 rounded-xl md:block" />
          <Skeleton className="hidden h-32 min-w-[18rem] flex-1 rounded-xl xl:block" />
        </div>
      </SkeletonCard>

      <SkeletonStatGrid />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <SkeletonCard>
          <SkeletonSectionHeader action />
          <div className="mt-4">
            <ListRows />
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonSectionHeader />
          <div className="mt-4">
            <ListRows count={3} avatar={false} />
          </div>
        </SkeletonCard>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-[34rem] max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl sm:w-72" />
        </div>
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          <div className="xl:col-span-2"><ChartSkeleton tall /></div>
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    </LoadingPage>
  );
}

export function AdminCalendarSkeleton() {
  return (
    <LoadingPage className="space-y-4">
      <div aria-hidden className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[24, 28, 24].map((width, index) => (
            <Skeleton key={index} className="h-7 rounded-full" style={{ width: `${width / 4}rem` }} />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="hidden h-10 w-32 rounded-lg md:block" />
        </div>
      </div>

      <SkeletonCard className="flex flex-col gap-2 p-2 md:flex-row md:items-center md:gap-3">
        <Skeleton className="h-10 w-full rounded-lg md:max-w-xs" />
        <div className="flex flex-1 items-center gap-2 md:justify-end">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <Skeleton className="h-5 min-w-0 flex-1 md:max-w-56" />
          <Skeleton className="size-10 shrink-0 rounded-lg" />
        </div>
      </SkeletonCard>

      <SkeletonCard className="overflow-hidden p-0 sm:p-0">
        <div className="md:hidden">
          <div className="flex items-center justify-between border-b p-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <div className="divide-y px-4">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="grid min-h-16 grid-cols-[3.5rem_1fr] gap-3 py-2">
                <Skeleton className="mt-1 h-3 w-10" />
                {index === 2 || index === 5 ? (
                  <Skeleton className="h-12 w-full rounded-lg" />
                ) : (
                  <div className="border-t border-dashed" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="hidden md:block">
          <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] gap-px border-b bg-border p-px">
            <div className="bg-card" />
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="space-y-2 bg-card px-2 py-3 text-center">
                <Skeleton className="mx-auto h-3 w-8" />
                <Skeleton className="mx-auto size-7 rounded-full" />
              </div>
            ))}
          </div>
          <div className="relative h-[38rem] overflow-hidden">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="grid h-16 grid-cols-[4rem_repeat(7,minmax(0,1fr))] gap-px border-b">
                <div className="px-2 pt-2"><Skeleton className="h-3 w-9" /></div>
                {Array.from({ length: 7 }).map((__, dayIndex) => (
                  <div key={dayIndex} className="border-l px-1 pt-1">
                    {(index === 2 && dayIndex === 1) || (index === 5 && dayIndex === 4) ? (
                      <Skeleton className="h-12 w-full rounded-md" />
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SkeletonCard>
    </LoadingPage>
  );
}

function RequestCardSkeleton({ expanded = false }: { expanded?: boolean }) {
  return (
    <SkeletonCard className="p-0 sm:p-0">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="size-8 shrink-0 rounded-lg" />
      </div>
      {expanded ? (
        <div className="space-y-4 border-t p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <Skeleton className="h-24 rounded-xl" />
          <div className="flex justify-end gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      ) : null}
    </SkeletonCard>
  );
}

export function AdminRequestsSkeleton() {
  return (
    <LoadingPage className="space-y-4">
      <SkeletonSectionHeader action />
      <Skeleton className="h-11 w-[42rem] max-w-full rounded-xl" />
      <div className="space-y-3">
        <RequestCardSkeleton expanded />
        <RequestCardSkeleton />
        <RequestCardSkeleton />
      </div>
    </LoadingPage>
  );
}

export function AdminApprovalsSkeleton() {
  return (
    <LoadingPage>
      <SkeletonCard>
        <SkeletonSectionHeader eyebrow action />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-xl p-4 ring-1 ring-foreground/10">
              <div className="flex items-start gap-3">
                <Skeleton className="size-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Skeleton className="h-11 rounded-lg sm:w-28" />
                <Skeleton className="h-11 rounded-lg sm:w-28" />
              </div>
            </div>
          ))}
        </div>
      </SkeletonCard>
    </LoadingPage>
  );
}

export function AdminClientsSkeleton() {
  return (
    <LoadingPage className="space-y-4">
      <SkeletonSectionHeader action />
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} className="flex items-center gap-3 p-3.5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48 max-w-full" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="hidden p-2 md:block">
        <div className="grid grid-cols-[1.2fr_1.4fr_1fr_0.8fr] gap-4 border-b px-3 py-3">
          {[24, 20, 16, 14].map((width, index) => (
            <Skeleton key={index} className="h-3" style={{ width: `${width / 4}rem` }} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1.2fr_1.4fr_1fr_0.8fr] items-center gap-4 border-b px-3 py-3 last:border-0">
            <div className="flex items-center gap-3"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-4 w-28" /></div>
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-7 w-20 rounded-full" />
          </div>
        ))}
      </SkeletonCard>
    </LoadingPage>
  );
}

export function AdminClientDetailSkeleton() {
  return (
    <LoadingPage>
      <Skeleton className="h-10 w-36 rounded-lg" />
      <SkeletonCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2"><Skeleton className="h-7 w-44" /><Skeleton className="h-7 w-24 rounded-full" /></div>
            <Skeleton className="h-4 w-64 max-w-full" />
            <div className="flex flex-wrap gap-2"><Skeleton className="h-9 w-28 rounded-lg" /><Skeleton className="h-9 w-32 rounded-lg" /></div>
          </div>
          <div className="flex gap-2"><Skeleton className="h-10 w-24 rounded-lg" /><Skeleton className="h-10 w-24 rounded-lg" /></div>
        </div>
      </SkeletonCard>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} className="space-y-3 p-4">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3.5 w-24 max-w-full" />
          </SkeletonCard>
        ))}
      </div>
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <SkeletonCard key={index}>
            <SkeletonSectionHeader action />
            <div className="mt-4"><ListRows count={4} avatar={false} /></div>
          </SkeletonCard>
        ))}
      </div>
    </LoadingPage>
  );
}

export function AdminAvailabilitySkeleton() {
  return (
    <LoadingPage>
      <Skeleton className="h-10 w-full rounded-xl sm:w-96" />
      <SkeletonCard>
        <SkeletonSectionHeader eyebrow description action />
        <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3 border-b p-3 last:border-0 sm:flex-row sm:items-center sm:px-4">
              <div className="flex items-center gap-3 sm:w-56"><Skeleton className="h-6 w-10 rounded-full" /><div className="space-y-1.5"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-14" /></div></div>
              <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:ml-auto sm:max-w-sm"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-3 w-3" /><Skeleton className="h-10 rounded-lg" /></div>
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 ml-auto h-11 w-full rounded-lg md:w-36" />
      </SkeletonCard>
    </LoadingPage>
  );
}

export function AdminAuditSkeleton() {
  return (
    <LoadingPage>
      <SkeletonCard className="p-0 sm:p-0">
        <div className="border-b px-4 py-3"><Skeleton className="h-3 w-44" /></div>
        <div className="divide-y md:hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-3 px-4 py-3">
              <div className="flex justify-between gap-3"><Skeleton className="h-7 w-32 rounded-full" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1.5fr] gap-4 border-b px-4 py-3">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-3 w-20" />)}
          </div>
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_1.5fr] items-center gap-4 border-b px-4 py-3 last:border-0">
              <Skeleton className="h-4 w-28 max-w-full" /><Skeleton className="h-4 w-24 max-w-full" /><Skeleton className="h-7 w-28 rounded-full" /><Skeleton className="h-3 w-24 max-w-full" /><Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </LoadingPage>
  );
}

export function AdminSettingsSkeleton() {
  return (
    <LoadingPage>
      <Skeleton className="h-10 w-full rounded-lg sm:w-96" />
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <SkeletonCard>
          <SkeletonSectionHeader description action />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
                <Skeleton className="size-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div>
                <Skeleton className="size-9 rounded-lg" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonSectionHeader description />
          <div className="mt-5 space-y-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <div className="grid grid-cols-2 gap-3"><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></div>
            <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
          </div>
        </SkeletonCard>
      </div>
    </LoadingPage>
  );
}
