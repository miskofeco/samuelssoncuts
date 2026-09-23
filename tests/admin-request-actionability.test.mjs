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

test("the queue counts pending decisions while proposal controls include sent proposals", () => {
  const queue = readFileSync("src/components/admin/request-queue.tsx", "utf8");
  const composer = readFileSync("src/components/admin/proposal-form.tsx", "utf8");

  assert.match(queue, /case "actionable":\s*return requiresAdminRequestAction\(status\)/);
  assert.match(composer, /const canPropose = canAdminSuggestAnotherTime\(request\.status\)/);
});

test("request headers only disclose real supplementary details", () => {
  const composer = readFileSync("src/components/admin/proposal-form.tsx", "utf8");

  assert.match(composer, /const hasDetails = request\.note\.trim\(\)\.length > 0 \|\| request\.preferences\.length > 0/);
  assert.match(composer, /const showBody = open \|\| \(canPropose && proposalControlsOpen\)/);
  assert.match(composer, /\{hasDetails \? \(\s*<button/);
});
