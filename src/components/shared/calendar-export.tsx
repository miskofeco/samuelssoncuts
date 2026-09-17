"use client";

import { AppleIcon, Copy01Icon, Download04Icon, Link01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";

import { Button, buttonClass } from "@/components/shared/button";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Icon icon={Download04Icon} className="size-4" strokeWidth={2} />
        {t.admin.export}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={t.admin.exportTitle}>
        <div className="space-y-5">
          {/* Download */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon icon={Download04Icon} className="size-4 text-muted-foreground" />
              {t.admin.exportDownloadHeading}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t.admin.exportDownloadHint}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <a href="/api/calendar/export?range=week" className={buttonClass("secondary")}>
                {t.admin.exportWeek}
              </a>
              <a href="/api/calendar/export?range=month" className={buttonClass("secondary")}>
                {t.admin.exportMonth}
              </a>
            </div>
          </section>

          {/* Subscribe */}
          {feedUrl ? (
            <>
              <Separator />
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icon icon={Link01Icon} className="size-4 text-muted-foreground" />
                  {t.admin.exportSubscribeHeading}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t.admin.exportSubscribeHint}
                </p>
                <div className="mt-3 flex gap-2">
                  <Input
                    readOnly
                    value={feedUrl}
                    aria-label={t.admin.exportSubscribeHeading}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 bg-muted/50 text-xs"
                  />
                  <Button type="button" variant="secondary" onClick={copyFeed} className="shrink-0">
                    <Icon icon={copied ? Tick02Icon : Copy01Icon} className="size-4" strokeWidth={2} />
                    {copied ? t.admin.exportCopied : t.admin.exportCopy}
                  </Button>
                </div>
                {webcalUrl ? (
                  <a href={webcalUrl} className={buttonClass("primary", "mt-3 w-full sm:w-auto")}>
                    <Icon icon={AppleIcon} className="size-[18px]" strokeWidth={2} />
                    {t.admin.exportSubscribeApple}
                  </a>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
