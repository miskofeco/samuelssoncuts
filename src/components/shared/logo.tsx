import Image from "next/image";

import { cn } from "@/lib/classnames";

// Horizontal "Samuelsson Cuts" wordmark. The black variant shows in light mode,
// the white variant in dark mode (toggled by the `.dark` class on <html>).
const INTRINSIC = { width: 1036, height: 295 };

export function Logo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <>
      <Image
        src="/logo-light.png"
        alt="Samuelsson Cuts"
        width={INTRINSIC.width}
        height={INTRINSIC.height}
        priority={priority}
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/logo-dark.png"
        alt="Samuelsson Cuts"
        width={INTRINSIC.width}
        height={INTRINSIC.height}
        priority={priority}
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}

// Square "S" mark for compact spots (collapsed sidebar rail). Black mark in
// light mode, white mark in dark mode.
const MARK = { width: 300, height: 300 };

export function LogoMark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <>
      <Image
        src="/icon-light.png"
        alt="Samuelsson Cuts"
        width={MARK.width}
        height={MARK.height}
        priority={priority}
        className={cn("size-8 dark:hidden", className)}
      />
      <Image
        src="/icon-dark.png"
        alt="Samuelsson Cuts"
        width={MARK.width}
        height={MARK.height}
        priority={priority}
        className={cn("hidden size-8 dark:block", className)}
      />
    </>
  );
}
