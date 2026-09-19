"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, LANGS, type Lang } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

// Module-scope helper keeps the document.cookie write out of the component body
// (the React Compiler lint disallows external mutations inside components).
function persistLang(next: Lang) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

// SK / EN switch. Persists the choice in the `lang` cookie, then refreshes so the
// server re-renders (layout, pages, provider) in the new language — single source
// of truth, no localStorage needed.
export function LanguageToggle({ className }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    if (!next || next === lang) return;
    persistLang(next as Lang);
    startTransition(() => router.refresh());
  }

  return (
    <ToggleGroup
      type="single"
      value={lang}
      onValueChange={choose}
      aria-label={t.language.label}
      spacing={0}
      variant="outline"
      className={cn("h-10 rounded-lg bg-card", pending && "opacity-70", className)}
    >
      {LANGS.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          aria-label={t.language.switchTo(t.language[option])}
          className="h-10 min-w-11 px-3 text-xs font-semibold uppercase data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {t.language[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
