import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { requiresAdminRequestAction } from "../src/domain/request-actionability.ts";

test("only pending booking requests require an admin decision", () => {
  assert.equal(requiresAdminRequestAction("pending"), true);
  assert.equal(requiresAdminRequestAction("proposed"), false);
  assert.equal(requiresAdminRequestAction("confirmed"), false);
  assert.equal(requiresAdminRequestAction("declined"), false);
});

test("the request queue and proposal controls use the same actionability rule", () => {
  const queue = readFileSync("src/components/admin/request-queue.tsx", "utf8");
  const composer = readFileSync("src/components/admin/proposal-form.tsx", "utf8");

  assert.match(queue, /case "actionable":\s*return requiresAdminRequestAction\(status\)/);
  assert.match(composer, /const canPropose = requiresAdminRequestAction\(request\.status\)/);
});
