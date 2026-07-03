"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import type { ActionResult } from "@/domain/types";
import { useT } from "@/i18n/provider";

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
  const disabled =
    pending || state === "checking" || state === "unsupported" || state === "unavailable" || state === "denied";

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader
        eyebrow={t.push.eyebrow}
        title={t.push.title}
        action={
          enabled ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={disable}>
              {pending ? t.push.disabling : t.push.disable}
            </Button>
          ) : (
            <Button type="button" disabled={disabled} onClick={enable}>
              {pending ? t.push.enabling : t.push.enable}
            </Button>
          )
        }
      />
      <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
        {state === "enabled"
          ? t.push.statusEnabled
          : state === "denied"
            ? t.push.statusDenied
            : state === "unsupported"
              ? t.push.statusUnsupported
              : state === "unavailable"
                ? t.push.statusUnavailable
                : t.push.statusReady}
      </p>
      <Feedback result={feedback} className="mt-3" />
    </Card>
  );
}
