"use client";

import { Cell, Pie, PieChart } from "recharts";

import { EmptyState } from "@/components/shared/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DonutLegend } from "./donut-legend";

// Donut of recorded appointment outcomes. Emerald = completed (good),
// red = no-show, stone = cancelled — reads at a glance in both themes.
const colors = {
  completed: "var(--chart-1)",
  no_show: "var(--destructive)",
  cancelled: "var(--chart-4)",
};

export function OutcomesChart({
  data,
  totalLabel,
  noShowRateLabel,
  emptyTitle,
  emptyDescription,
}: {
  data: { label: string; value: number; key: string }[];
  totalLabel: string;
  noShowRateLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const attended = data
    .filter((item) => item.key === "completed" || item.key === "no_show")
    .reduce((sum, item) => sum + item.value, 0);
  const noShows = data.find((item) => item.key === "no_show")?.value ?? 0;
  const noShowRate = attended > 0 ? Math.round((noShows / attended) * 100) : 0;
  const chartData = data.map((item) => ({ ...item, fill: colors[item.key as keyof typeof colors] }));
  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((item) => [
      item.key,
      { label: item.label, color: colors[item.key as keyof typeof colors] },
    ]),
  );

  if (total === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="h-full border-0 bg-transparent py-6"
      />
    );
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(8rem,0.75fr)] items-center gap-3 sm:gap-5">
      <div className="relative h-full min-w-0">
        <ChartContainer
          config={chartConfig}
          className="h-full w-full aspect-auto"
          aria-label={chartData.map((item) => `${item.label}: ${item.value}`).join(", ")}
          role="img"
        >
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="key"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              cornerRadius={4}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="key" indicator="dot" />}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {total}
          </span>
          <span className="max-w-20 text-center text-[0.65rem] leading-tight font-medium text-muted-foreground">
            {totalLabel}
          </span>
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {noShowRate}%
          </p>
          <p className="text-xs font-medium text-muted-foreground">{noShowRateLabel}</p>
        </div>
        <DonutLegend data={data} colors={colors} />
      </div>
    </div>
  );
}
