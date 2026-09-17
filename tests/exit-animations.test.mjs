import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("src/components/shared/modal.tsx", "utf8");
const sheet = readFileSync("src/components/shared/sheet.tsx", "utf8");
const mobileNav = readFileSync("src/components/layout/mobile-nav.tsx", "utf8");
const appShell = readFileSync("src/components/layout/app-shell.tsx", "utf8");
const sidebar = readFileSync("src/components/layout/sidebar.tsx", "utf8");
const attentionRefresh = readFileSync("src/components/layout/attention-refresh.tsx", "utf8");
const realtimeBadge = readFileSync("src/hooks/use-realtime-badge.ts", "utf8");
const uiDialog = readFileSync("src/components/ui/dialog.tsx", "utf8");
const uiSheet = readFileSync("src/components/ui/sheet.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

// The responsive Modal is a vaul Drawer on phones and a Radix Dialog from `sm`
// up. Both keep their nodes mounted while the close animation plays (Radix
// Presence / vaul), so exit animations need no hand-rolled mounted state and
// scroll locking is delegated to the primitives.
test("modal is a responsive shadcn dialog/drawer without hand-rolled overlay state", () => {
  assert.match(modal, /from "@\/components\/ui\/dialog"/);
  assert.match(modal, /from "@\/components\/ui\/drawer"/);
  assert.match(modal, /useIsMobile\(\)/);
  assert.match(modal, /<DialogContent[\s\S]*showCloseButton=\{false\}/);
  assert.match(modal, /<DrawerContent/);
  assert.doesNotMatch(modal, /const \[mounted, setMounted\]/);
  assert.doesNotMatch(modal, /document\.body\.style\.overflow/);
  assert.match(uiDialog, /data-open:animate-in[\s\S]*data-closed:animate-out/);
});

test("modal keeps header/footer outside the scroll container and respects safe areas", () => {
  // Body scrolls; header and sticky footer stay visible on both layouts.
  assert.match(modal, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(modal, /pb-\[max\(1\.25rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(modal, /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(modal, /max-h-\[calc\(100dvh-env\(safe-area-inset-top\)-2\.5rem\)\]/);
  assert.match(modal, /max-h-\[min\(90vh,calc\(100dvh-2rem\)\)\]/);
  assert.match(modal, /overflow-hidden/);
  // Close buttons are localized (no hard-coded English from the primitive).
  assert.match(modal, /aria-label=\{t\.common\.close\}/);
});

test("side sheet wraps the shadcn Sheet with an accessible title and localized close", () => {
  assert.match(sheet, /from "@\/components\/ui\/sheet"/);
  assert.match(sheet, /<SheetTitle className="sr-only">/);
  assert.match(sheet, /<SheetClose asChild>/);
  assert.match(sheet, /aria-label=\{t\.common\.close\}/);
  assert.match(sheet, /env\(safe-area-inset-bottom\)/);
  assert.match(uiSheet, /data-open:animate-in[\s\S]*data-closed:animate-out/);
});

test("mobile navigation uses bottom tabs plus sheets that close on route change", () => {
  assert.match(mobileNav, /<nav[\s\S]*fixed inset-x-0 bottom-0/);
  assert.match(mobileNav, /pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(mobileNav, /<Sheet[\s\S]*onOpenChange=\{setMoreOpen\}/);
  assert.match(mobileNav, /<Sheet[\s\S]*onOpenChange=\{setAccountOpen\}/);
  assert.match(mobileNav, /openedAt !== pathname/);
  assert.doesNotMatch(mobileNav, /document\.body\.style\.overflow/);
  assert.doesNotMatch(mobileNav, /lucide-react/);
});

// The realtime attention nudge is mounted exactly once by the shell so no
// navigation surface (desktop sidebar, bottom tabs, sheets) can open a second
// channel by rendering twice.
test("admin attention refresh is mounted once in the shell, not inside navigation", () => {
  assert.match(attentionRefresh, /useAttentionRefresh\(\)/);
  assert.match(appShell, /role === "admin" \? <AttentionRefresh \/> : null/);
  assert.doesNotMatch(sidebar, /useAttentionRefresh/);
  assert.doesNotMatch(mobileNav, /useAttentionRefresh/);
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

test("legacy data-state animation classes stay defined for custom overlays", () => {
  for (const className of ["ss-overlay", "ss-modal-panel", "ss-drawer", "ss-popover"]) {
    assert.match(css, new RegExp(`\\.${className}\\[data-state="open"\\]`));
    assert.match(css, new RegExp(`\\.${className}\\[data-state="closed"\\]`));
  }
  // Legacy animation classes are still used by the consent banner.
  assert.match(css, /\.ss-banner-in\b/);
  // shadcn primitives animate through tw-animate-css and the shadcn variants.
  assert.match(css, /@import "tw-animate-css";/);
  assert.match(css, /@import "shadcn\/tailwind\.css";/);
});
