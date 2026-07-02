"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

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
      <div className="flex h-full items-center justify-center text-sm text-stone-500 dark:text-stone-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex h-full items-center gap-4">
      <div className="h-full flex-1">
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
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(120,120,120,0.2)",
                background: "var(--surface)",
                color: "var(--foreground)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="shrink-0 space-y-2">
        {data.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors[entry.key] }}
            />
            <span className="text-stone-600 dark:text-stone-300">{entry.label}</span>
            <span className="font-semibold tabular-nums text-black dark:text-white">
              {entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
