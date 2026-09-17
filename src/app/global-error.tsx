"use client";

import { Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect } from "react";

// Last-resort boundary for errors thrown in the root layout itself. It replaces
// the entire document, so it renders its own <html>/<body> and cannot rely on
// the i18n/theme providers, Tailwind classes or the token stylesheet — styling
// is inline (CSP allows inline styles) and text is intentionally static English.
// Colours mirror the stone palette in globals.css; a small <style> block flips
// them for users who prefer a dark scheme.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style>{GLOBAL_ERROR_CSS}</style>
      </head>
      <body className="ge-body">
        <main className="ge-card" role="alert">
          <div className="ge-icon" aria-hidden>
            <HugeiconsIcon icon={Alert02Icon} size={28} strokeWidth={1.8} />
          </div>
          <h1 className="ge-title">Something went wrong</h1>
          <p className="ge-body-text">An unexpected error occurred. Please try again.</p>
          <button type="button" onClick={reset} className="ge-button">
            <HugeiconsIcon icon={RefreshIcon} size={20} strokeWidth={1.8} aria-hidden />
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

const GLOBAL_ERROR_CSS = `
:root{--ge-bg:#fafaf9;--ge-card:#ffffff;--ge-fg:#1c1917;--ge-muted:#78716c;--ge-ring:rgba(28,25,23,.1);--ge-danger:#dc2626;--ge-danger-bg:rgba(220,38,38,.1);--ge-primary:#1c1917;--ge-primary-fg:#fafaf9;}
@media (prefers-color-scheme:dark){:root{--ge-bg:#1c1917;--ge-card:#292524;--ge-fg:#fafaf9;--ge-muted:#a8a29e;--ge-ring:rgba(250,250,249,.1);--ge-danger:#f87171;--ge-danger-bg:rgba(220,38,38,.2);--ge-primary:#fafaf9;--ge-primary-fg:#1c1917;}}
*{box-sizing:border-box}
.ge-body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom));background:var(--ge-bg);color:var(--ge-fg);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.ge-card{width:100%;max-width:28rem;background:var(--ge-card);border-radius:1rem;box-shadow:0 0 0 1px var(--ge-ring),0 1px 2px rgba(0,0,0,.05);padding:2rem 1.5rem;text-align:center;display:flex;flex-direction:column;align-items:center}
.ge-icon{width:3.5rem;height:3.5rem;border-radius:1rem;display:flex;align-items:center;justify-content:center;background:var(--ge-danger-bg);color:var(--ge-danger);box-shadow:0 0 0 1px var(--ge-ring)}
.ge-title{margin:1rem 0 0;font-size:1.25rem;line-height:1.75rem;font-weight:600;letter-spacing:-0.01em}
.ge-body-text{margin:.5rem 0 0;font-size:.875rem;line-height:1.5rem;color:var(--ge-muted)}
.ge-button{margin-top:1.5rem;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;width:100%;height:2.75rem;padding:0 1.25rem;border-radius:.5rem;border:0;background:var(--ge-primary);color:var(--ge-primary-fg);font:inherit;font-size:1rem;font-weight:600;cursor:pointer}
.ge-button:hover{opacity:.85}
.ge-button:focus-visible{outline:3px solid rgba(120,113,108,.5);outline-offset:2px}
@media (min-width:640px){.ge-card{padding:2.5rem 2rem}.ge-button{width:auto}}
`;
