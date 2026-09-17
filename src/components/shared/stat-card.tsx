import { ArrowDownRight01Icon, ArrowUpRight01Icon, MinusSignIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";

import { Icon } from "@/components/shared/icon";
import { Card } from "@/components/ui/card";
import type { PercentageTrend } from "@/domain/analytics";
import { cn } from "@/lib/classnames";

type Tone = "neutral" | "amber" | "emerald" | "sky";
type Variant = "default" | "overview";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-foreground",
  amber: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  sky: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
};

function isIconSource(icon: ReactNode | IconSvgElement): icon is IconSvgElement {
  return Array.isArray(icon);
}

/**
 * KPI tile. Compact two-up on phones (icon + value + label), roomier from `sm`
 * with the hint line. `icon` accepts a hugeicons source or any node.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode | IconSvgElement;
  /** Kept for call-site compatibility; both variants share one layout now. */
  variant?: Variant;
  trend?: PercentageTrend;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "gap-0 overflow-visible p-3.5 shadow-xs transition-shadow hover:shadow-sm sm:p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10", tones[tone])}>
          {icon ? (
            isIconSource(icon) ? (
              <Icon icon={icon} className="size-[18px] sm:size-5" />
            ) : (
              <span className="[&_svg]:size-[18px] sm:[&_svg]:size-5">{icon}</span>
            )
          ) : (
            <span aria-hidden className="size-2 rounded-full bg-current opacity-60" />
          )}
        </span>
        {trend ? <TrendPill trend={trend} /> : null}
      </div>
      <div className="mt-3 sm:mt-4">
        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">{value}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        {hint ? <p className="mt-1 hidden truncate text-xs text-muted-foreground/80 sm:block">{hint}</p> : null}
      </div>
    </Card>
  );
}

function TrendPill({ trend }: { trend: PercentageTrend }) {
  const isDown = trend.direction === "down";
  const isFlat = trend.direction === "flat";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-xs font-semibold tabular-nums",
        isFlat
          ? "bg-muted text-muted-foreground"
          : isDown
            ? "bg-destructive/10 text-destructive"
            : "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
      )}
    >
      <Icon
        icon={isFlat ? MinusSignIcon : isDown ? ArrowDownRight01Icon : ArrowUpRight01Icon}
        className="size-3.5"
        strokeWidth={2.2}
      />
      <span>{trend.percent}%</span>
    </span>
  );
}
