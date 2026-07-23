"use client";

export function RevenueByServiceChart({
  data,
  emptyLabel,
}: {
  data: { label: string; revenue: number }[];
  emptyLabel: string;
}) {
  const total = data.reduce((sum, item) => sum + item.revenue, 0);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      {data.map((item) => {
        const share = total > 0 ? (item.revenue / total) * 100 : 0;
        const shareLabel = `${Math.round(share)}%`;

        return (
          <div key={item.label} className="min-w-0">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {item.label}
                </p>
                <p className="text-xs font-medium text-stone-400 dark:text-stone-500">
                  {shareLabel}
                </p>
              </div>
              <p className="shrink-0 text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {item.revenue} €
              </p>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-[#f1f2f5] dark:bg-stone-800"
              role="img"
              aria-label={`${item.label}: ${item.revenue} €, ${shareLabel} of service revenue`}
            >
              <div className="h-full rounded-full bg-stone-950 dark:bg-white" style={{ width: `${share}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
