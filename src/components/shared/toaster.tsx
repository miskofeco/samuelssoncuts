"use client";

import { useSyncExternalStore } from "react";
import { Toaster as SonnerToaster } from "sonner";

export { toast } from "sonner";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * App-wide toast host (sonner). Follows the `dark` class set by ThemeScript so
 * toasts match the active theme rather than the OS preference.
 */
export function Toaster() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as const);
  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      closeButton
      richColors
      offset={{ top: "max(1rem, env(safe-area-inset-top))" }}
      mobileOffset={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      toastOptions={{
        classNames: {
          toast: "rounded-xl border shadow-lg text-sm font-medium",
        },
      }}
    />
  );
}
