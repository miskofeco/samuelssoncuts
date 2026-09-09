import { timingSafeEqual } from "node:crypto";

// Constant-time check of `Authorization: Bearer <CRON_SECRET>`. A plain string
// comparison short-circuits on the first mismatching byte, which leaks how much
// of the secret an attacker has guessed. Length is compared first because
// timingSafeEqual requires equal-length buffers; the length of the secret is
// not considered sensitive.
export function isAuthorizedCronRequest(authHeader: string | null, secret: string): boolean {
  if (!authHeader || !secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(authHeader, "utf8");

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
