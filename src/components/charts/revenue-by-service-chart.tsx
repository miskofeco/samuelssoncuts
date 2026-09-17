"use client";

/**
 * Ranked share breakdown: one row per service with its revenue and a
 * proportional bar. Monochrome fill via `bg-primary`.
 */
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
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-4 overflow-y-auto">
      {data.map((item) => {
        const share = total > 0 ? (item.revenue / total) * 100 : 0;
        const shareLabel = `${Math.round(share)}%`;

        return (
          <div key={item.label} className="min-w-0">
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs font-medium text-muted-foreground tabular-nums">{shareLabel}</p>
              </div>
              <p className="shrink-0 text-lg font-semibold text-foreground tabular-nums">
                {item.revenue} €
              </p>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-[#f1f2f5] dark:bg-muted"
              role="img"
              aria-label={`${item.label}: ${item.revenue} €, ${shareLabel} of service revenue`}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
