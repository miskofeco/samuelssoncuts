/**
 * Merge class names. Re-exports shadcn's compiled `cn` (clsx + tailwind-merge
 * semantics: conditionals/arrays are flattened and conflicting Tailwind
 * utilities resolve last-wins), so callers can safely override primitive
 * defaults via `className`. `@/lib/utils` is the shadcn alias for the same.
 */
export { cn } from "cn";
