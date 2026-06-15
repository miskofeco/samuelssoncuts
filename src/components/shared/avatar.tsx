import Image from "next/image";

import { initials } from "@/lib/initials";
import { cn } from "@/lib/classnames";

const sizes = {
  sm: "h-8 w-8 text-[0.7rem]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

// Pixel dimensions matching the size classes above — needed for next/image.
const pixels = {
  sm: 32,
  md: 40,
  lg: 48,
};

export function Avatar({
  name,
  src,
  size = "md",
  tone = "dark",
  className,
}: {
  name: string;
  /** Profile picture URL. Falls back to the initials circle when absent. */
  src?: string | null;
  size?: keyof typeof sizes;
  tone?: "dark" | "muted";
  className?: string;
}) {
  if (src) {
    const px = pixels[size];
    return (
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        className={cn(
          "shrink-0 rounded-full object-cover",
          sizes[size],
          className,
        )}
      />
    );
  }

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
