import assert from "node:assert/strict";
import test from "node:test";

import { metricScaleTicks } from "../src/domain/chart-scale.ts";

test("metricScaleTicks uses real small integer values when the chart data is small", () => {
  assert.deepEqual(metricScaleTicks(3), [3, 2, 1, 0]);
});

test("metricScaleTicks rounds larger values to readable intervals", () => {
  assert.deepEqual(metricScaleTicks(87), [100, 75, 50, 25, 0]);
  assert.deepEqual(metricScaleTicks(275), [300, 225, 150, 75, 0]);
});

test("metricScaleTicks keeps an empty chart readable", () => {
  assert.deepEqual(metricScaleTicks(0), [1, 0]);
});
