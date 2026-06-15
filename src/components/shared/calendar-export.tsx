"use client";

import { useState } from "react";

import { Button } from "@/components/shared/button";
import { Modal } from "@/components/shared/modal";
import { useT } from "@/i18n/provider";

// Export / subscribe control for the admin calendar. Both paths produce the same
// .ics (stable per-appointment UID), so re-importing or refreshing updates
// matched events instead of duplicating them.
export function CalendarExport({ feedUrl }: { feedUrl?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Apple Calendar subscribes via the webcal:// scheme.
  const webcalUrl = feedUrl?.replace(/^https?:\/\//, "webcal://");

  async function copyFeed() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the input is selectable as a fallback.
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <DownloadIcon />
        {t.admin.export}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={t.admin.exportTitle}>
        <div className="space-y-6">
          {/* Download */}
          <section>
            <h3 className="text-sm font-semibold text-black dark:text-white">
              {t.admin.exportDownloadHeading}
            </h3>
            <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">
              {t.admin.exportDownloadHint}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="/api/calendar/export?range=week"
                className="inline-flex h-10 items-center justify-center rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950 transition hover:bg-stone-50 dark:border-white/15 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
              >
                {t.admin.exportWeek}
              </a>
              <a
                href="/api/calendar/export?range=month"
                className="inline-flex h-10 items-center justify-center rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-950 transition hover:bg-stone-50 dark:border-white/15 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
              >
                {t.admin.exportMonth}
              </a>
            </div>
          </section>

          {/* Subscribe */}
          {feedUrl ? (
            <section className="border-t border-black/10 pt-5 dark:border-white/10">
              <h3 className="text-sm font-semibold text-black dark:text-white">
                {t.admin.exportSubscribeHeading}
              </h3>
              <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">
                {t.admin.exportSubscribeHint}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-10 min-w-0 flex-1 rounded-md border border-black/10 bg-stone-50 px-3 text-xs text-stone-700 outline-none dark:border-white/15 dark:bg-stone-800 dark:text-stone-300"
                />
                <Button type="button" variant="secondary" onClick={copyFeed}>
                  {copied ? t.admin.exportCopied : t.admin.exportCopy}
                </Button>
              </div>
              {webcalUrl ? (
                <a
                  href={webcalUrl}
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
                >
                  <AppleIcon />
                  {t.admin.exportSubscribeApple}
                </a>
              ) : null}
            </section>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

// Apple logo. fill="currentColor" so it inherits the button text color —
// white on the black light-mode button, black on the white dark-mode button.
function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.54c-.02-1.86 1.52-2.75 1.59-2.79-.87-1.27-2.22-1.44-2.7-1.46-1.15-.12-2.24.68-2.83.68-.58 0-1.48-.66-2.44-.65-1.25.02-2.41.73-3.05 1.85-1.3 2.26-.33 5.6.93 7.43.62.9 1.36 1.9 2.32 1.87.93-.04 1.28-.6 2.41-.6 1.12 0 1.44.6 2.42.58 1-.02 1.63-.91 2.24-1.81.71-1.04 1-2.05 1.02-2.1-.02-.01-1.95-.75-1.97-2.97zM15.2 6.86c.51-.62.86-1.48.76-2.34-.74.03-1.64.49-2.17 1.11-.47.55-.89 1.43-.78 2.27.83.07 1.67-.42 2.19-1.04z" />
    </svg>
  );
}
