import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/classnames";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-black text-white hover:bg-stone-800 disabled:bg-stone-300 dark:bg-white dark:text-black dark:hover:bg-stone-200 dark:disabled:bg-stone-700 dark:disabled:text-stone-400",
  secondary:
    "border border-stone-200 bg-white text-stone-950 hover:border-stone-300 hover:bg-stone-50 dark:border-white/15 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
  ghost:
    "bg-transparent text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
  danger:
    "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-200 dark:bg-red-600 dark:hover:bg-red-500",
};

const base =
  "inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed dark:focus:ring-white dark:focus:ring-offset-stone-900";

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export function Button({ className, variant = "primary", children, ...props }: ButtonProps) {
  return (
    <button className={buttonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
};

/** A link styled as a button (for navigation, not actions). */
export function ButtonLink({
  href,
  className,
  variant = "primary",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass(variant, className)} {...props}>
      {children}
    </Link>
  );
}
