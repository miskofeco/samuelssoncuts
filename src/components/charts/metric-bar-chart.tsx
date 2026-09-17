import { metricScaleTicks } from "@/domain/chart-scale";
import { cn } from "@/lib/classnames";

export type MetricBarChartItem = {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  ariaLabel: string;
};

/**
 * Column chart drawn with plain divs: a y-axis of scale ticks on the left, one
 * progress-style column per item, and value/label captions underneath. Fills
 * follow `currentColor` so the parent controls the monochrome accent.
 */
export function MetricBarChart({
  items,
  className,
}: {
  items: MetricBarChartItem[];
  className?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);
  const scale = metricScaleTicks(max);
  const scaleMax = scale[0] ?? 1;

  return (
    <div
      className={cn(
        "grid h-full grid-cols-[2rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 text-foreground sm:gap-x-4",
        className,
      )}
    >
      <div className="col-start-1 row-start-1 flex h-full flex-col justify-between pt-1 text-xs font-medium text-muted-foreground tabular-nums sm:text-sm">
        {scale.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <div
        className="col-start-2 row-start-1 grid min-h-0 min-w-0 gap-2 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const height =
            scaleMax > 0 ? Math.max((item.value / scaleMax) * 100, item.value > 0 ? 3 : 0) : 0;

          return (
            <div
              key={item.key}
              className="relative min-h-0 min-w-0 overflow-hidden rounded-lg bg-[#f1f2f5] dark:bg-muted"
              role="img"
              aria-label={item.ariaLabel}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-lg bg-current transition-[height] duration-300"
                style={{
                  height: `${height}%`,
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        className="col-start-2 row-start-2 grid min-w-0 gap-2 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <div key={item.key} className="min-w-0 text-center">
            <p className="truncate text-base font-semibold text-foreground tabular-nums sm:text-xl">
              {item.valueLabel}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground sm:text-sm">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
