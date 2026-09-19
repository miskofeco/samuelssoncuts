"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useSyncExternalStore } from "react";

import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

type Theme = "light" | "dark";

// Subscribe to the `dark` class on <html> so the toggle reflects the real theme
// (set pre-paint by ThemeScript) without a setState-in-effect.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function useTheme() {
  // Server renders "light"; the class is reconciled on the client after mount.
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);

  function setTheme(next: Theme) {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Persistence is best-effort.
    }
  }

  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useT();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? t.theme.switchToLight : t.theme.switchToDark}
      title={isDark ? t.theme.light : t.theme.dark}
      className={cn("bg-card", className)}
    >
      <Icon icon={isDark ? Sun03Icon : Moon02Icon} className="size-[18px]" />
    </Button>
  );
}
