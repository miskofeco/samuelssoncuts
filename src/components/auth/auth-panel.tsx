"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useT } from "@/i18n/provider";

export function AuthPanel({
  children,
  error,
  message,
  mode,
}: {
  children: ReactNode;
  error?: string;
  message?: string;
  mode: "login" | "register";
}) {
  const t = useT();

  return (
    <main className="desktop-zoom app-surface grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md rounded-2xl p-6 sm:p-7">
        <Logo className="h-10" priority />
        <span className="sr-only">{t.auth.srTitle}</span>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-black dark:text-white">
          {mode === "login" ? t.auth.welcomeBack : t.auth.requestAccess}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {mode === "login" ? t.auth.loginSubtitle : t.auth.registerSubtitle}
        </p>

        {error ? <Feedback result={{ ok: false, error }} className="mt-4" /> : null}
        {message ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300">
            {message}
          </p>
        ) : null}

        <div className="mt-5">{children}</div>

        <p className="mt-5 text-sm text-stone-600 dark:text-stone-400">
          {mode === "login" ? t.auth.needAccess : t.auth.alreadyApproved}{" "}
          <Link
            href={mode === "login" ? "/register" : "/login"}
            className="font-semibold text-black underline-offset-4 hover:underline dark:text-white"
          >
            {mode === "login" ? t.auth.registerLink : t.auth.signInLink}
          </Link>
        </p>
      </Card>
    </main>
  );
}
