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

test("business hours use the shared quarter-hour combobox instead of native time inputs", () => {
  const combobox = readFileSync("src/components/shared/combobox.tsx", "utf8");
  assert.doesNotMatch(businessHours, /type="time"/);
  assert.equal(businessHours.match(/<Combobox/g)?.length, 2);
  assert.match(businessHours, /quarterHourTimes\(current\)/);
  // Each field keeps its weekday in the accessible name, and saved off-grid values survive.
  assert.match(businessHours, /ariaLabel=\{`\$\{name\} \$\{t\.admin\.from\}`\}/);
  assert.match(businessHours, /ariaLabel=\{`\$\{name\} \$\{t\.admin\.to\}`\}/);
  assert.match(readFileSync("src/domain/schedule.ts", "utf8"), /current && !times\.includes\(current\) \? \[\.\.\.times, current\]\.sort\(\) : times/);
  assert.match(businessHours, /error=\{invalid \? t\.admin\.businessHoursInvalid : undefined\}/);
  assert.match(combobox, /aria-invalid=\{error \? true : undefined\}/);
});
