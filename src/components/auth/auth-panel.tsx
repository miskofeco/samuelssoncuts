import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/shared/card";
import { Feedback } from "@/components/shared/feedback";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

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
  return (
    <main className="app-surface grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md rounded-2xl p-6 sm:p-7">
        <Logo className="h-10" priority />
        <span className="sr-only">Samuelsson Cuts</span>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-black dark:text-white">
          {mode === "login" ? "Welcome back" : "Request access"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">
          {mode === "login"
            ? "Sign in to continue to your scheduler."
            : "Create your account. The barber approves new clients before booking unlocks."}
        </p>

        {error ? <Feedback result={{ ok: false, error }} className="mt-4" /> : null}
        {message ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300">
            {message}
          </p>
        ) : null}

        <div className="mt-5">{children}</div>

        <p className="mt-5 text-sm text-stone-600 dark:text-stone-400">
          {mode === "login" ? "Need access?" : "Already approved?"}{" "}
          <Link
            href={mode === "login" ? "/register" : "/login"}
            className="font-semibold text-black underline-offset-4 hover:underline dark:text-white"
          >
            {mode === "login" ? "Register" : "Sign in"}
          </Link>
        </p>
      </Card>
    </main>
  );
}
