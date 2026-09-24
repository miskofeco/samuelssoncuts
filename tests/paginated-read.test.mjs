import assert from "node:assert/strict";
import test from "node:test";

import { readAllPages } from "../src/server/paginated-read.ts";

test("collects more than 1,000 rows without dropping the last page", async () => {
  const source = Array.from({ length: 1_205 }, (_, id) => ({ id }));
  const offsets = [];
  const rows = await readAllPages("rows", async (from, to) => {
    offsets.push(from);
    return { data: source.slice(from, to + 1), error: null };
  });

  assert.deepEqual(rows, source);
  assert.deepEqual(offsets, [0, 500, 1_000, 1_205]);
});

test("continues when the server caps each requested range below the page size", async () => {
  const source = Array.from({ length: 1_105 }, (_, id) => ({ id }));
  const offsets = [];
  const rows = await readAllPages("rows", async (from, to) => {
    offsets.push(from);
    return { data: source.slice(from, Math.min(to + 1, from + 100)), error: null };
  });

  assert.deepEqual(rows, source);
  assert.deepEqual(offsets, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1_000, 1_100, 1_105]);
});

test("fails visibly on a later page error instead of returning partial analytics", async () => {
  await assert.rejects(
    readAllPages("appointments", async (from) => from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
      : { data: null, error: { message: "connection lost" } }),
    /appointments: connection lost/,
  );
});
