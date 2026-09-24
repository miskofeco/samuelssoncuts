"use client";

import { AppleIcon, Copy01Icon, Download04Icon, Link01Icon, Refresh01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import { useState, useTransition } from "react";

import { rotateCalendarTokenAction } from "@/app/actions";
import { Button, buttonClass } from "@/components/shared/button";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import type { ActionResult } from "@/domain/types";
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
  const [rotating, startRotate] = useTransition();
  const [rotateResult, setRotateResult] = useState<ActionResult | null>(null);

  // The feed URL is a bearer secret; a leaked one can only be revoked by
  // rotating. The action revalidates the page, so the new URL flows in as a prop.
  function rotate() {
    setRotateResult(null);
    startRotate(async () => {
      try {
        setRotateResult(await rotateCalendarTokenAction());
      } catch {
        setRotateResult({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  // Apple Calendar subscribes via the webcal:// scheme; Google Calendar's
  // subscribe screen takes the same webcal URL as its `cid` parameter. Google
  // fetches the feed from its servers, so it only works on a public HTTPS host.
  const webcalUrl = feedUrl?.replace(/^https?:\/\//, "webcal://");
  const googleSubscribeUrl = webcalUrl
    ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`
    : undefined;

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
                {webcalUrl && googleSubscribeUrl ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap">
                    <a
                      href={googleSubscribeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClass("secondary", "w-full min-w-0 sm:w-auto")}
                    >
                      <Image src="/email-icons/google.png" alt="" width={18} height={18} className="size-[18px]" />
                      {t.admin.exportSubscribeGoogle}
                    </a>
                    {/* Same solid Apple button as the appointment detail page. */}
                    <a
                      href={webcalUrl}
                      className={buttonClass(
                        "secondary",
                        "w-full min-w-0 border-black bg-black text-white hover:bg-black/90 hover:text-white sm:w-auto dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90 dark:hover:text-black",
                      )}
                    >
                      <Icon icon={AppleIcon} className="size-[18px] [&_path]:fill-current" />
                      {t.admin.exportSubscribeApple}
                    </a>
                  </div>
                ) : null}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">{t.admin.exportRotateHint}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={rotate}
                  loading={rotating}
                  className="mt-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Icon icon={Refresh01Icon} className="size-4" strokeWidth={2} />
                  {t.admin.exportRotate}
                </Button>
                <Feedback result={rotateResult} className="mt-3" />
              </section>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
