import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/shared/modal.tsx", "utf8");
const mobileNav = readFileSync("src/components/layout/mobile-nav.tsx", "utf8");
const realtimeBadge = readFileSync("src/hooks/use-realtime-badge.ts", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

const sheet = readFileSync("src/components/shared/sheet.tsx", "utf8");

// Radix Presence keeps Dialog content mounted while the [data-state="closed"]
// animation plays, so exit animations no longer need hand-rolled mounted state.
test("modal is a Radix dialog with data-state driven enter/exit animations", () => {
  assert.match(modal, /from "radix-ui"/);
  assert.match(modal, /<Dialog\.Portal>/);
  assert.match(modal, /<Dialog\.Overlay className="ss-overlay /);
  assert.match(modal, /"ss-modal-panel /);
  assert.doesNotMatch(modal, /const \[mounted, setMounted\]/);
  assert.doesNotMatch(modal, /document\.body\.style\.overflow/);
});

test("mobile sidebar drawer is a Radix sheet with a close button", () => {
  assert.match(mobileNav, /<Sheet /);
  assert.match(mobileNav, /onOpenChange=\{setOpen\}/);
  assert.match(sheet, /from "radix-ui"/);
  assert.match(sheet, /"ss-drawer /);
  assert.match(sheet, /<Dialog\.Close/);
  assert.match(sheet, /<Dialog\.Title className="sr-only">/);
  assert.doesNotMatch(mobileNav, /document\.body\.style\.overflow/);
});

test("sidebar attention refresh cleans up its realtime channel on unmount", () => {
  assert.match(realtimeBadge, /export function useAttentionRefresh/);
  assert.match(realtimeBadge, /removeChannel/);
});

test("sidebar attention refresh uses a per-mount realtime channel", () => {
  assert.match(realtimeBadge, /useId/);
  assert.match(realtimeBadge, /const channelName = `admin-attention-\$\{channelId\.replaceAll\(":", ""\)\}`/);
  assert.match(realtimeBadge, /supabase\.channel\(channelName\)/);
  assert.doesNotMatch(realtimeBadge, /supabase\.channel\("admin-attention"\)/);
});

test("exit animation classes are defined for overlays, modals, and drawers", () => {
  for (const className of ["ss-overlay", "ss-modal-panel", "ss-drawer", "ss-popover"]) {
    assert.match(css, new RegExp(`\\.${className}\\[data-state="open"\\]`));
    assert.match(css, new RegExp(`\\.${className}\\[data-state="closed"\\]`));
  }
  // Legacy animation classes are still used by the consent banner.
  assert.match(css, /\.ss-banner-in\b/);
});

test("modal keeps the close button visible on mobile and caps height to the visible viewport", () => {
  assert.match(modal, /pt-\[max\(0\.75rem,env\(safe-area-inset-top\)\)\]/);
  assert.match(modal, /pb-0/);
  assert.match(modal, /sm:p-4/);
  assert.match(modal, /max-h-\[calc\(100dvh-env\(safe-area-inset-top\)-env\(safe-area-inset-bottom\)-1\.5rem\)\]/);
  assert.match(modal, /overflow-hidden/);
  // Header and footer sit outside the scroll container so they stay visible.
  assert.match(modal, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(modal, /pb-\[max\(1\.25rem,env\(safe-area-inset-bottom\)\)\]/);
});
