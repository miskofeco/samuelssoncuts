/** Shared legend for the donut charts: colour swatch, label, count. */
export function DonutLegend({
  data,
  colors,
}: {
  data: { label: string; value: number; key: string }[];
  colors: Record<string, string>;
}) {
  return (
    <ul className="min-w-0 shrink-0 space-y-2">
      {data.map((entry) => (
        <li key={entry.key} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: colors[entry.key] }}
          />
          <span className="min-w-0 truncate text-muted-foreground">{entry.label}</span>
          <span className="ml-auto font-semibold text-foreground tabular-nums">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}
