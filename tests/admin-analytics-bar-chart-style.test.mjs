import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin analytics bar charts use the screenshot-style progress bars", () => {
  const weekday = readFileSync("src/components/charts/bookings-by-weekday-chart.tsx", "utf8");
  const progress = readFileSync("src/components/charts/metric-bar-chart.tsx", "utf8");

  assert.match(weekday, /import \{ MetricBarChart \} from "\.\/metric-bar-chart"/);
  assert.doesNotMatch(weekday, /\bBarChart\b|CartesianGrid|XAxis|YAxis/);
  assert.match(progress, /grid-cols-\[2rem_minmax\(0,1fr\)\] grid-rows-\[minmax\(0,1fr\)_auto\]/);
  assert.match(progress, /gridTemplateColumns: `repeat\(\$\{items\.length\}, minmax\(0, 1fr\)\)`/);
  assert.match(progress, /bg-\[#f1f2f5\]/);
  assert.match(progress, /rounded-lg/);
  assert.match(progress, /bottom-0 left-0 right-0/);
  assert.match(progress, /col-start-2 row-start-2/);
  assert.match(progress, /aria-label=\{item\.ariaLabel/);
  assert.match(progress, /metricScaleTicks\(max\)/);
  assert.doesNotMatch(progress, /overflow-x-auto|min-w-full|minmax\(4\.75rem|h-\[13rem\]/);
});

test("revenue by service uses a ranked share breakdown instead of vertical bars", () => {
  const revenue = readFileSync("src/components/charts/revenue-by-service-chart.tsx", "utf8");

  assert.doesNotMatch(revenue, /MetricBarChart|\bBarChart\b|CartesianGrid|XAxis|YAxis/);
  assert.match(revenue, /const total = data\.reduce/);
  assert.match(revenue, /const share = total > 0 \? \(item\.revenue \/ total\) \* 100 : 0/);
  assert.match(revenue, /rounded-full bg-\[#f1f2f5\]/);
  assert.match(revenue, /width: `\$\{share\}%`/);
  assert.match(revenue, /const shareLabel = `\$\{Math\.round\(share\)\}%`/);
});
