import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin analytics uses the shadcn chart wrapper for interactive charts", () => {
  const weekday = readFileSync("src/components/charts/bookings-by-weekday-chart.tsx", "utf8");
  const performance = readFileSync("src/components/charts/performance-trend-chart.tsx", "utf8");

  for (const source of [weekday, performance]) {
    assert.match(source, /ChartContainer/);
    assert.match(source, /ChartTooltip/);
    assert.match(source, /role="img"/);
  }
  assert.match(weekday, /\bBarChart\b/);
  assert.match(performance, /PerformanceMetric/);
  assert.match(performance, /dataKey="bookings"/);
  assert.match(performance, /dataKey="bookingValue"/);
});

test("booking value by service uses a ranked horizontal bar chart", () => {
  const revenue = readFileSync("src/components/charts/revenue-by-service-chart.tsx", "utf8");

  assert.match(revenue, /ChartContainer/);
  assert.match(revenue, /layout="vertical"/);
  assert.match(revenue, /dataKey="revenue"/);
  assert.match(revenue, /LabelList/);
  assert.match(revenue, /Intl\.NumberFormat/);
});

test("analytics charts use semantic chart tokens instead of hard-coded palettes", () => {
  const chartFiles = [
    "src/components/charts/performance-trend-chart.tsx",
    "src/components/charts/bookings-by-weekday-chart.tsx",
    "src/components/charts/revenue-by-service-chart.tsx",
    "src/components/charts/requests-by-status-chart.tsx",
    "src/components/charts/outcomes-chart.tsx",
  ];
  const hardCodedColor = /#[0-9a-f]{3,8}/i;

  for (const file of chartFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, hardCodedColor, file);
    assert.match(source, /var\(--chart-|var\(--destructive\)/, file);
  }
});
