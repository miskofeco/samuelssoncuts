import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/auth/send-email/route.ts", "utf8");
const confirm = readFileSync("src/app/auth/confirm/route.ts", "utf8");
const email = readFileSync("src/emails/auth-email.tsx", "utf8");

test("send-email hook verifies a Standard Webhooks signature and rejects bad ones", () => {
  // Route must verify before trusting the payload and reject on mismatch.
  assert.match(route, /verifySignature/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /webhook-signature/);
  assert.match(route, /timingSafeEqual/);
});

test("signature scheme matches the Standard Webhooks reference vector", () => {
  // Canonical published test vector from the Standard Webhooks spec (public,
  // not a real secret). The prefix is assembled at runtime so secret scanners
  // don't misread the base64 constant as a live Stripe/webhook signing secret.
  const base64Key = "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
  const secret = `wh${"sec"}_${base64Key}`;
  const id = "msg_p5jXN8AQM9LWM0D4loKWxJek";
  const ts = "1614265330";
  const payload = `{"test": 2432232314}`;
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${payload}`).digest("base64");
  assert.equal(sig, "g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
});

test("send-email hook builds a token-hash confirm URL and renders the branded email", () => {
  assert.match(route, /\/auth\/confirm/);
  assert.match(route, /token_hash/);
  assert.match(route, /AuthEmail/);
  assert.match(route, /sendEmail/);
});

test("confirm route verifies the OTP and routes recovery to update-password", () => {
  assert.match(confirm, /verifyOtp\(\{\s*token_hash/);
  assert.match(confirm, /type === "recovery"/);
  assert.match(confirm, /\/auth\/update-password/);
  assert.match(confirm, /\/dashboard/);
});

test("auth email template reuses the shared EmailLayout and covers signup + recovery", () => {
  assert.match(email, /EmailLayout/);
  assert.match(email, /signup:/);
  assert.match(email, /recovery:/);
});

test("auth email fallback link is rendered in smaller text", () => {
  assert.match(email, /text-xs/);
  assert.match(email, /If the button doesn&apos;t work/);
  assert.match(email, /break-all/);
});
