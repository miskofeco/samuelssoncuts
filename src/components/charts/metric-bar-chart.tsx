import { metricScaleTicks } from "@/domain/chart-scale";
import { cn } from "@/lib/classnames";

export type MetricBarChartItem = {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  ariaLabel: string;
};

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
        "grid h-full grid-cols-[2rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 text-stone-950 sm:gap-x-4 dark:text-white",
        className,
      )}
    >
      <div className="col-start-1 row-start-1 flex h-full flex-col justify-between pt-1 text-sm font-medium tabular-nums text-stone-700 dark:text-stone-300">
        {scale.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <div
        className="col-start-2 row-start-1 grid min-h-0 min-w-0 gap-3 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const height =
            scaleMax > 0 ? Math.max((item.value / scaleMax) * 100, item.value > 0 ? 3 : 0) : 0;

          return (
            <div
              key={item.key}
              className="relative min-h-0 min-w-0 overflow-hidden rounded-lg bg-[#f1f2f5] dark:bg-stone-800"
              role="img"
              aria-label={item.ariaLabel}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-lg bg-current"
                style={{
                  height: `${height}%`,
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        className="col-start-2 row-start-2 grid min-w-0 gap-3 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <div key={item.key} className="min-w-0 text-center">
            <p className="truncate text-lg font-medium tabular-nums text-stone-900 dark:text-stone-100 sm:text-2xl">
              {item.valueLabel}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-stone-400 dark:text-stone-500 sm:text-base">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
