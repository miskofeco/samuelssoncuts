import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

type Tone = "neutral" | "amber" | "emerald" | "sky";

const tones: Record<Tone, { ring: string; value: string; dot: string }> = {
  neutral: {
    ring: "border-black/10 dark:border-white/10",
    value: "text-black dark:text-white",
    dot: "bg-stone-400",
  },
  amber: {
    ring: "border-amber-200 dark:border-amber-500/30",
    value: "text-amber-900 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  emerald: {
    ring: "border-emerald-200 dark:border-emerald-500/30",
    value: "text-emerald-900 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  sky: {
    ring: "border-sky-200 dark:border-sky-500/30",
    value: "text-sky-900 dark:text-sky-300",
    dot: "bg-sky-500",
  },
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const palette = tones[tone];

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/85 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur-sm transition hover:shadow-[0_16px_50px_rgba(0,0,0,0.07)] dark:bg-stone-900/70",
        palette.ring,
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
