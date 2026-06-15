import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/shared/modal.tsx", "utf8");
const mobileNav = readFileSync("src/components/layout/mobile-nav.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

test("modal remains mounted while playing its close animation", () => {
  assert.match(modal, /const \[mounted, setMounted\]/);
  assert.match(modal, /onAnimationEnd/);
  assert.match(modal, /ss-overlay-out/);
  assert.match(modal, /ss-modal-panel-out/);
  assert.doesNotMatch(modal, /if \(!open\) return null;/);
});

test("mobile sidebar remains mounted while playing its close animation", () => {
  assert.match(mobileNav, /const \[mounted, setMounted\]/);
  assert.match(mobileNav, /onAnimationEnd/);
  assert.match(mobileNav, /ss-overlay-out/);
  assert.match(mobileNav, /ss-drawer-out/);
  assert.match(mobileNav, /\{mounted \? \(/);
  assert.doesNotMatch(
    mobileNav,
    /\n\s*\{open \? \(\n\s*<div className="fixed inset-0 z-50 lg:hidden">/,
  );
});

test("exit animation classes are defined for overlays, modals, and drawers", () => {
  for (const className of [
    "ss-overlay-out",
    "ss-modal-panel-out",
    "ss-drawer-out",
  ]) {
    assert.match(css, new RegExp(`\\.${className}\\b`));
  }
});
