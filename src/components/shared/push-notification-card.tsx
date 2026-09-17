"use client";

import { Notification03Icon, NotificationOff01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

type PushState =
  | "checking"
  | "ready"
  | "enabled"
  | "denied"
  | "unsupported"
  | "unavailable";

type PublicKeyResponse =
  | { ok: true; publicKey: string }
  | { ok: false; reason?: string; error?: string };

function supportsPush() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function applicationServerKey(publicKey: string) {
  const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
  const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function loadPublicKey(): Promise<string | null> {
  const response = await fetch("/api/push/public-key", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as PublicKeyResponse;
  return json.ok ? json.publicKey : null;
}

async function registrationWithWorker() {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  return existing ?? navigator.serviceWorker.register("/sw.js");
}

export function PushNotificationCard() {
  const t = useT();
  const [state, setState] = useState<PushState>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!supportsPush()) {
        setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      const key = await loadPublicKey();
      if (cancelled) return;
      if (!key) {
        setState("unavailable");
        return;
      }
      setPublicKey(key);

      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (cancelled) return;
      setState(subscription ? "enabled" : "ready");
    }

    check().catch(() => {
      if (!cancelled) setState("unavailable");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setFeedback(null);
    startTransition(async () => {
      try {
        if (!supportsPush() || !publicKey) {
          setState("unavailable");
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === "denied") {
          setState("denied");
          setFeedback({ ok: false, error: t.push.notificationsDenied });
          return;
        }
        if (permission !== "granted") {
          setState("ready");
          return;
        }

        const registration = await registrationWithWorker();
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });

        const response = await fetch("/api/push/subscriptions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });
        if (!response.ok) throw new Error("subscribe failed");

        setState("enabled");
        setFeedback({ ok: true, message: t.push.notificationsEnabled });
      } catch {
        setFeedback({ ok: false, error: t.push.notificationsCouldNotEnable });
      }
    });
  }

  function disable() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        const endpoint = subscription?.endpoint;

        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await subscription?.unsubscribe();

        setState("ready");
        setFeedback({ ok: true, message: t.push.notificationsDisabled });
      } catch {
        setFeedback({ ok: false, error: t.push.notificationsCouldNotDisable });
      }
    });
  }

  const enabled = state === "enabled";
  const blocked = state === "denied" || state === "unsupported" || state === "unavailable";
  const disabled = pending || state === "checking" || blocked;

  const statusText =
    state === "enabled"
      ? t.push.statusEnabled
      : state === "denied"
        ? t.push.statusDenied
        : state === "unsupported"
          ? t.push.statusUnsupported
          : state === "unavailable"
            ? t.push.statusUnavailable
            : t.push.statusReady;

  return (
    <Card className="rounded-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              enabled
                ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                : blocked
                  ? "bg-muted text-muted-foreground"
                  : "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
            )}
          >
            <Icon icon={blocked ? NotificationOff01Icon : Notification03Icon} className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {t.push.eyebrow}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t.push.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {statusText}
            </p>
          </div>
        </div>
        <div className="shrink-0 *:w-full sm:*:w-auto">
          {enabled ? (
            <Button type="button" variant="secondary" size="lg" loading={pending} onClick={disable} className="sm:h-10 sm:text-sm">
              {pending ? t.push.disabling : t.push.disable}
            </Button>
          ) : (
            <Button type="button" size="lg" disabled={disabled} loading={pending} onClick={enable} className="sm:h-10 sm:text-sm">
              {pending ? t.push.enabling : t.push.enable}
            </Button>
          )}
        </div>
      </div>
      <Feedback result={feedback} className="mt-4" />
    </Card>
  );
}
