import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const manifest = readFileSync("src/app/manifest.ts", "utf8");

test("iPhone home screen icon uses the uploaded public icon", () => {
  assert.match(layout, /apple:\s*"\/iphone_icon\.png"/);
  assert.match(manifest, /src:\s*"\/iphone_icon\.png"/);
  assert.match(manifest, /sizes:\s*"600x602"/);
});
