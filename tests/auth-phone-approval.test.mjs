import assert from "node:assert/strict";
import test from "node:test";

import { isValidPhone, normalizePhone, parsePhone } from "../src/domain/phone.ts";
import { isReadyForApproval } from "../src/domain/approval.ts";

test("normalizePhone strips separators and folds the 00 prefix into +", () => {
  assert.equal(normalizePhone(" +421 900 123 456 "), "+421900123456");
  assert.equal(normalizePhone("0900-123-456"), "0900123456");
  assert.equal(normalizePhone("(0)900.123.456"), "0900123456");
  assert.equal(normalizePhone("00421900123456"), "+421900123456");
});

test("isValidPhone accepts 7–15 digits with an optional + and nothing else", () => {
  assert.equal(isValidPhone("+421900123456"), true);
  assert.equal(isValidPhone("0900123456"), true);
  assert.equal(isValidPhone("1234567"), true);
  assert.equal(isValidPhone("123456"), false);
  assert.equal(isValidPhone("+" + "1".repeat(16)), false);
  assert.equal(isValidPhone("abcd"), false);
  assert.equal(isValidPhone("+421 900"), false);
  assert.equal(isValidPhone("++421900123456"), false);
});

test("parsePhone returns the canonical number or null", () => {
  assert.equal(parsePhone("+421 900 123 456"), "+421900123456");
  assert.equal(parsePhone("abcd"), null);
  assert.equal(parsePhone(""), null);
});

test("an account is approval-ready only with a confirmed email and a phone", () => {
  assert.equal(isReadyForApproval({ emailConfirmed: true, phone: "+421900123456" }), true);
  assert.equal(isReadyForApproval({ emailConfirmed: true, phone: null }), false);
  assert.equal(isReadyForApproval({ emailConfirmed: true, phone: "   " }), false);
  assert.equal(isReadyForApproval({ emailConfirmed: false, phone: "+421900123456" }), false);
});
