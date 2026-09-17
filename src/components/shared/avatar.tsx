import Image from "next/image";

import { initials } from "@/lib/initials";
import { cn } from "@/lib/classnames";

const sizes = {
  xs: "size-6 text-[0.6rem]",
  sm: "size-8 text-[0.7rem]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
};

// Pixel dimensions matching the size classes above — needed for next/image.
const pixels = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 };

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
          "shrink-0 rounded-full object-cover ring-1 ring-foreground/10",
          sizes[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none",
        sizes[size],
        tone === "dark" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
