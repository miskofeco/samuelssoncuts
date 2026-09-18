"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/shared/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export function RevenueByServiceChart({
  data,
  valueLabel,
  emptyTitle,
  emptyDescription,
  locale,
}: {
  data: { label: string; revenue: number }[];
  valueLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  locale: string;
}) {
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const chartConfig = {
    revenue: {
      label: valueLabel,
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;
  const chartHeight = Math.max(240, data.length * 48);

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        className="h-full border-0 bg-transparent py-6"
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto pe-1">
      <ChartContainer
        config={chartConfig}
        className="w-full aspect-auto"
        style={{ height: chartHeight }}
        aria-label={data.map((item) => `${item.label}: ${currency.format(item.revenue)}`).join(", ")}
        role="img"
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 72, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            width={104}
            tickMargin={8}
            tickFormatter={(value: string) =>
              value.length > 16 ? `${value.slice(0, 15)}…` : value
            }
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.45 }}
            content={
              <ChartTooltipContent
                hideLabel
                hideIndicator
                formatter={(value, _name, item) => (
                  <div className="flex min-w-44 items-center justify-between gap-4">
                    <span className="max-w-36 truncate text-muted-foreground">
                      {item.payload.label}
                    </span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {currency.format(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="revenue"
            fill="var(--color-revenue)"
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
            activeBar={{ fillOpacity: 0.76 }}
          >
            <LabelList
              dataKey="revenue"
              position="right"
              offset={10}
              formatter={(value) => currency.format(Number(value ?? 0))}
              className="fill-foreground font-mono text-[0.68rem] font-semibold"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
