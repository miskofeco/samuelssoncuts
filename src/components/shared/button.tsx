import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/classnames";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-white dark:focus-visible:ring-offset-stone-900 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-black text-white shadow-sm hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200",
        secondary:
          "border border-stone-200 bg-white text-stone-950 shadow-sm hover:border-stone-300 hover:bg-stone-50 dark:border-white/15 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
        ghost:
          "bg-transparent text-stone-700 hover:bg-stone-100 hover:text-black dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white",
        danger:
          "bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:ring-red-700 dark:bg-red-600 dark:hover:bg-red-500 dark:focus-visible:ring-red-500",
        dangerOutline:
          "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-700 dark:border-red-500/30 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10",
        link: "h-auto min-h-0 rounded-none px-0 text-stone-700 underline-offset-4 hover:underline dark:text-stone-300",
      },
      size: {
        sm: "min-h-9 px-3 text-xs [&_svg]:size-3.5",
        md: "min-h-10 px-4 text-sm [&_svg]:size-4",
        lg: "min-h-12 px-5 text-base [&_svg]:size-5",
        icon: "size-10 [&_svg]:size-4",
        iconSm: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

/** Class string for a button-styled element (kept for `<form>`/`<Link>` callers). */
export function buttonClass(variant: ButtonVariant = "primary", className?: string, size: ButtonSize = "md") {
  return cn(buttonVariants({ variant, size }), className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    children: ReactNode;
    /** Shows a spinner, sets aria-busy and disables the button. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof buttonVariants> & {
    href: string;
    children: ReactNode;
  };

/** A link styled as a button (for navigation, not actions). */
export function ButtonLink({ href, className, variant, size, children, ...props }: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}
