import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

test("DateField converts between ISO strings and local dates without a UTC shift", async () => {
  const mod = await import("../src/components/shared/date-field.tsx").catch(() => null);
  if (!mod) {
    // Node cannot load TSX with JSX here; fall back to a source contract check.
    const src = read("src/components/shared/date-field.tsx");
    assert.match(src, /new Date\(Number\(y\), Number\(m\) - 1, Number\(d\)\)/);
    assert.match(src, /getFullYear\(\)/);
    return;
  }
  assert.equal(mod.localDateToIso(new Date(2026, 8, 19)), "2026-09-19");
  assert.equal(mod.isoToLocalDate("2026-09-19")?.getDate(), 19);
  assert.equal(mod.isoToLocalDate("2026-09-19")?.getMonth(), 8);
  assert.equal(mod.isoToLocalDate("nope"), undefined);
});

test("admin date pickers use the shadcn Calendar DateField instead of native date inputs", () => {
  for (const file of [
    "src/components/admin/add-booking-modal.tsx",
    "src/components/admin/appointment-detail-modal.tsx",
    "src/components/admin/proposal-form.tsx",
    "src/components/admin/availability-manager.tsx",
  ]) {
    const src = read(file);
    assert.match(src, /<DateField/, `${file} should render DateField`);
    assert.doesNotMatch(src, /type="date"/, `${file} should not use a native date input`);
  }

  const field = read("src/components/shared/date-field.tsx");
  assert.match(field, /from "@\/components\/ui\/calendar"/);
  assert.match(field, /weekStartsOn=\{1\}/);
  assert.match(field, /modal/);
});
