"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/shared/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Semantic status colours: amber = new/pending, sky = proposed, emerald =
// confirmed, stone = closed. Same accents as the StatusPill tones.
const colors = {
  pending: "var(--chart-3)",
  proposed: "var(--chart-2)",
  confirmed: "var(--chart-1)",
  declined: "var(--chart-4)",
};

export function RequestsByStatusChart({
  data,
  requestsLabel,
  emptyTitle,
  emptyDescription,
}: {
  data: { label: string; value: number; key: string }[];
  requestsLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = data.map((item) => ({ ...item, fill: colors[item.key as keyof typeof colors] }));
  const chartConfig = Object.fromEntries(
    data.map((item) => [
      item.key,
      { label: item.label, color: colors[item.key as keyof typeof colors] },
    ]),
  ) satisfies ChartConfig;

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
    <ChartContainer
      config={chartConfig}
      className="h-full w-full aspect-auto"
      aria-label={chartData.map((item) => `${item.label}: ${item.value}`).join(", ")}
      role="img"
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          width={82}
          tickMargin={8}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.45 }}
          content={
            <ChartTooltipContent
              hideLabel
              hideIndicator
              formatter={(value, _name, item) => (
                <div className="flex min-w-36 items-center justify-between gap-4">
                  <span className="text-muted-foreground">{item.payload.label}</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {Number(value)} {requestsLabel}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={30}>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
