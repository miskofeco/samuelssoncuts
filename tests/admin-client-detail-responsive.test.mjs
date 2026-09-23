import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientDetail = readFileSync("src/components/admin/client-detail.tsx", "utf8");

test("client moderation actions stack at full width on phones", () => {
  assert.match(clientDetail, /grid grid-cols-1 gap-2 sm:flex/);
  assert.equal(clientDetail.match(/className="[^"]*w-full[^"]*sm:w-auto[^"]*"/g)?.length, 3);
});
