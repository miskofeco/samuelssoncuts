import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const businessHours = readFileSync("src/components/admin/business-hours-editor.tsx", "utf8");

test("business-hours time fields stay inside padded phone rows", () => {
  assert.match(
    businessHours,
    /grid w-full min-w-0 max-w-full grid-cols-\[minmax\(0,1fr\)\]/,
  );
  assert.equal(
    businessHours.match(/className="w-full min-w-0 max-w-full"/g)?.length,
    2,
  );
});
