import type { ReactNode } from "react";

import type { PercentageTrend } from "@/domain/analytics";
import { cn } from "@/lib/classnames";

type Tone = "neutral" | "amber" | "emerald" | "sky";
type Variant = "default" | "overview";

const tones: Record<Tone, { ring: string; value: string; dot: string }> = {
  neutral: {
    ring: "border-black/10 dark:border-white/10",
    value: "text-black dark:text-white",
    dot: "bg-stone-400",
  },
  amber: {
    ring: "border-amber-200 dark:border-amber-500/30",
    value: "text-black dark:text-white",
    dot: "bg-amber-500",
  },
  emerald: {
    ring: "border-emerald-200 dark:border-emerald-500/30",
    value: "text-black dark:text-white",
    dot: "bg-emerald-500",
  },
  sky: {
    ring: "border-sky-200 dark:border-sky-500/30",
    value: "text-black dark:text-white",
    dot: "bg-sky-500",
  },
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  variant = "default",
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  variant?: Variant;
  trend?: PercentageTrend;
  className?: string;
}) {
  const palette = tones[tone];

  if (variant === "overview") {
    return (
      <div
        className={cn(
          "min-h-32 rounded-lg border border-black/10 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.035)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.055)] dark:border-white/10 dark:bg-stone-900",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-black dark:border-white/10 dark:bg-stone-950 dark:text-white">
            {icon ?? <span className={cn("h-2.5 w-2.5 rounded-full", palette.dot)} />}
          </span>
          {trend ? <TrendPill trend={trend} /> : null}
        </div>
        <div className="mt-6">
          <p className="truncate text-sm font-medium text-stone-400 dark:text-stone-500">
            {label}
          </p>
          <p className={cn("mt-1 text-3xl font-semibold tabular-nums tracking-normal", palette.value)}>
            {value}
          </p>
          {hint ? <p className="mt-1 truncate text-sm text-stone-500 dark:text-stone-400">{hint}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/85 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur-sm transition hover:shadow-[0_16px_50px_rgba(0,0,0,0.07)] dark:bg-stone-900/70",
        palette.ring,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-stone-500 dark:text-stone-400">
          {label}
        </p>
        {icon ? (
          <span className="text-stone-400">{icon}</span>
        ) : (
          <span className={cn("h-2 w-2 rounded-full", palette.dot)} />
        )}
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tabular-nums tracking-tight", palette.value)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{hint}</p> : null}
    </div>
  );
}

function TrendPill({ trend }: { trend: PercentageTrend }) {
  const isDown = trend.direction === "down";
  const isFlat = trend.direction === "flat";

  return (
    <span
      className={cn(
        "inline-flex min-h-7 min-w-16 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold tabular-nums",
        isFlat
          ? "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300"
          : isDown
            ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      )}
      title={
        isFlat
          ? "No change from previous period"
          : `${trend.percent}% ${isDown ? "down" : "up"} from previous period`
      }
    >
      <span aria-hidden="true">{isFlat ? "→" : isDown ? "↘" : "↗"}</span>
      <span>{trend.percent}%</span>
    </span>
  );
}
