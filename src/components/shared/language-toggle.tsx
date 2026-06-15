"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, LANGS, type Lang } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

// Module-scope helper keeps the document.cookie write out of the component body
// (the React Compiler lint disallows external mutations inside components).
function persistLang(next: Lang) {
  document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
}

// SK / EN switch. Persists the choice in the `lang` cookie, then refreshes so the
// server re-renders (layout, pages, provider) in the new language — single source
// of truth, no localStorage needed.
export function LanguageToggle({ className }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Lang) {
    if (next === lang) return;
    persistLang(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      aria-label={t.language.label}
      className={cn(
        "inline-flex h-9 items-center rounded-lg border border-black/10 bg-white p-0.5 text-xs font-semibold dark:border-white/10 dark:bg-stone-900",
        pending && "opacity-70",
        className,
      )}
    >
      {LANGS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => choose(option)}
          aria-pressed={option === lang}
          aria-label={t.language.switchTo(t.language[option])}
          className={cn(
            "h-8 rounded-md px-2.5 uppercase transition",
            option === lang
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-stone-500 hover:text-black dark:text-stone-400 dark:hover:text-white",
          )}
        >
          {t.language[option]}
        </button>
      ))}
    </div>
  );
}
