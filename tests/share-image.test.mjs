import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shareImage = readFileSync("src/lib/share-image.tsx", "utf8");

test("share image is Slovak, uses the original marks, and degrades without web fonts", () => {
  assert.match(shareImage, /const HEADLINE = \["Váš strih\.", "Váš čas\."\]/);
  assert.match(shareImage, /export const shareImageAlt = "Samuelsson Cuts – online rezervácie/);
  assert.match(shareImage, /publicDataUrl\("logo-dark\.png"\)/);
  assert.match(shareImage, /publicDataUrl\("icon-dark\.png"\)/);
  // Font binaries stay out of git; a failed fetch falls back to bundled Geist Regular.
  assert.match(shareImage, /catch \{\s*return null;\s*\}/);
  assert.match(shareImage, /const fonts = \[medium, bold\]\.filter\(\(font\) => font !== null\)/);
  assert.doesNotMatch(shareImage, /Book your cut|"BOOK", "CONFIRM", "CUT"/);
  // Greyscale only: no location, no brass or green accents.
  assert.doesNotMatch(shareImage, /Vranov|VRANOV|#d4a373|BRASS|#10b981|CONFIRMED|emerald/);
  assert.match(shareImage, /background: slot\.booked \? TEXT : "rgba\(250,250,249,0\.03\)"/);
});
