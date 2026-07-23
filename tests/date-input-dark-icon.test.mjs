import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dark mode makes native date picker calendar indicators visible", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  assert.match(css, /\.dark input\[type="date"\]::-webkit-calendar-picker-indicator/);
  assert.match(css, /filter: invert\(1\)/);
});
