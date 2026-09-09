import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names. `clsx` handles conditionals/arrays and `tailwind-merge`
 * resolves conflicting Tailwind utilities (the last one wins), so callers can
 * safely override primitive defaults via `className`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
