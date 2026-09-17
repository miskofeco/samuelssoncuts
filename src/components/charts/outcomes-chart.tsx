"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { chartTooltipStyle } from "./chart-theme";
import { DonutLegend } from "./donut-legend";

// Donut of recorded appointment outcomes. Emerald = completed (good),
// red = no-show, stone = cancelled — reads at a glance in both themes.
const colors: Record<string, string> = {
  completed: "#10b981",
  no_show: "#ef4444",
  cancelled: "#a8a29e",
};

export function OutcomesChart({
  data,
  emptyLabel,
}: {
  data: { label: string; value: number; key: string }[];
  emptyLabel: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-full items-center gap-4">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 256 }}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={colors[entry.key]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <DonutLegend data={data} colors={colors} />
    </div>
  );
}
