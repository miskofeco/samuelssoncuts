import { initials } from "@/lib/initials";
import { cn } from "@/lib/classnames";

const sizes = {
  sm: "h-8 w-8 text-[0.7rem]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function Avatar({
  name,
  size = "md",
  tone = "dark",
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  tone?: "dark" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        sizes[size],
        tone === "dark"
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
