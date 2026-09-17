"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useT } from "@/i18n/provider";

import { chartTooltipStyle } from "./chart-theme";
import { DonutLegend } from "./donut-legend";

// Semantic status colours: amber = new/pending, sky = proposed, emerald =
// confirmed, stone = closed. Same accents as the StatusPill tones.
const colors: Record<string, string> = {
  pending: "#f59e0b",
  proposed: "#0ea5e9",
  confirmed: "#10b981",
  declined: "#a8a29e",
};

export function RequestsByStatusChart({
  data,
}: {
  data: { label: string; value: number; key: string }[];
}) {
  const t = useT();
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t.charts.noRequestsYet}
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
